const mongoose = require('mongoose');

const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const presence = require('../presence');
const { getPairKey } = require('../utils/conversation');
const { getAcceptedConversation } = require('../utils/relationship');
const { serializeMessage, serializeStatusEvent } = require('../utils/serialize');
const { verifyToken } = require('../utils/token');
const { userRoom } = require('../realtime');

const MAX_TEXT_LENGTH = 2000;
const MAX_CIPHER_LENGTH = 8000;
const MAX_NONCE_LENGTH = 128;
const MAX_ALG_LENGTH = 32;
const OFFLINE_GRACE_MS = Number(process.env.PRESENCE_GRACE_MS) || 5000;

const offlineTimers = new Map();

function conversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

function reply(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

function broadcastPresence(io, userId, online, lastSeen) {
  io.emit('presence:update', {
    userId: String(userId),
    online,
    lastSeen: lastSeen || null,
  });
}

function scheduleOffline(io, userId) {
  const key = String(userId);
  clearTimeout(offlineTimers.get(key));

  const timer = setTimeout(async () => {
    offlineTimers.delete(key);

    if (presence.isOnline(key)) {
      return;
    }

    const lastSeen = new Date();

    try {
      await User.updateOne({ _id: key }, { $set: { lastSeen } });
    } catch (err) {
      console.error('[presence] failed to persist lastSeen', err);
    }

    broadcastPresence(io, key, false, lastSeen);
  }, OFFLINE_GRACE_MS);

  offlineTimers.set(key, timer);
}

function cancelOffline(userId) {
  const key = String(userId);
  clearTimeout(offlineTimers.get(key));
  offlineTimers.delete(key);
}

function broadcastStatus(io, message) {
  const event = serializeStatusEvent(message);

  io.to(conversationRoom(message.conversationId)).emit('message:status', event);
  io
    .to(userRoom(message.senderId))
    .except(conversationRoom(message.conversationId))
    .emit('message:status', event);
}

async function persistMessage({
  senderId,
  recipientId,
  text,
  cipher,
  nonce,
  alg,
  clientMessageId,
}) {
  const conversationId = getPairKey(senderId, recipientId);

  try {
    const message = await Message.create({
      conversationId,
      senderId,
      recipientId,
      text: text || null,
      cipher: cipher || null,
      nonce: nonce || null,
      alg: alg || null,
      clientMessageId,
      status: 'sent',
    });

    return { message, created: true };
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await Message.findOne({ senderId, clientMessageId });

      if (existing) {
        return { message: existing, created: false };
      }
    }

    throw err;
  }
}

async function transitionDelivered(messageId, recipientId) {
  const updated = await Message.findOneAndUpdate(
    { _id: messageId, recipientId, status: 'sent' },
    { $set: { status: 'delivered', deliveredAt: new Date() } },
    { new: true }
  );

  if (updated) {
    return { changed: true, message: updated };
  }

  const existing = await Message.findById(messageId);

  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  if (String(existing.recipientId) !== String(recipientId)) {
    return { error: 'FORBIDDEN' };
  }

  return { changed: false, message: existing };
}

async function readConversation(conversationId, recipientId) {
  const now = new Date();

  const unread = await Message.find({
    conversationId,
    recipientId,
    status: { $ne: 'read' },
  }).select('_id');

  if (unread.length === 0) {
    return { updatedIds: [] };
  }

  const ids = unread.map((doc) => doc._id);

  await Message.updateMany({ _id: { $in: ids } }, [
    {
      $set: {
        status: 'read',
        readAt: now,
        deliveredAt: { $ifNull: ['$deliveredAt', now] },
      },
    },
  ]);

  return { updatedIds: ids.map((id) => String(id)) };
}

function authenticate(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const userId = verifyToken(token);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return next(new Error('unauthorized'));
    }

    try {
      const exists = await User.exists({ _id: userId });

      if (!exists) {
        return next(new Error('unauthorized'));
      }

      socket.data.userId = String(userId);
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });
}

module.exports = function registerChatHandlers(io) {
  authenticate(io);

  io.on('connection', (socket) => {
    const userId = socket.data.userId;

    console.log(`[socket] connected: ${socket.id} (user ${userId})`);

    socket.join(userRoom(userId));

    cancelOffline(userId);

    const { becameOnline } = presence.add(userId, socket.id);

    if (becameOnline) {
      broadcastPresence(io, userId, true, null);
    }

    socket.emit('presence:snapshot', {
      onlineUserIds: presence.onlineUserIds(),
      at: new Date().toISOString(),
    });

    socket.on('conversation:join', async (payload, ack) => {
      const otherId = payload && payload.otherId;

      if (!mongoose.isValidObjectId(otherId)) {
        return reply(ack, { ok: false, error: 'INVALID_PAYLOAD' });
      }

      const conversation = await getAcceptedConversation(userId, otherId);

      if (!conversation) {
        return reply(ack, { ok: false, error: 'NOT_CONNECTED' });
      }

      socket.join(conversationRoom(conversation.pairKey));

      return reply(ack, { ok: true, conversationId: conversation.pairKey });
    });

    socket.on('message:send', async (payload, ack) => {
      try {
        const recipientId = payload && payload.recipientId;
        const clientMessageId = payload && payload.clientMessageId;
        const rawText = payload && payload.text;
        const rawCipher = payload && payload.cipher;
        const rawNonce = payload && payload.nonce;
        const rawAlg = payload && payload.alg;

        if (!mongoose.isValidObjectId(recipientId)) {
          return reply(ack, { ok: false, error: 'INVALID_PARTICIPANTS' });
        }

        if (String(userId) === String(recipientId)) {
          return reply(ack, { ok: false, error: 'SELF_MESSAGE' });
        }

        if (typeof clientMessageId !== 'string' || !clientMessageId.trim()) {
          return reply(ack, { ok: false, error: 'MISSING_CLIENT_MESSAGE_ID' });
        }

        const hasCipher =
          typeof rawCipher === 'string' &&
          rawCipher.trim().length > 0 &&
          typeof rawNonce === 'string' &&
          rawNonce.trim().length > 0 &&
          typeof rawAlg === 'string' &&
          rawAlg.trim().length > 0;

        const hasText = typeof rawText === 'string' && rawText.trim().length > 0;

        if (!hasCipher && !hasText) {
          return reply(ack, { ok: false, error: 'EMPTY_MESSAGE' });
        }

        if (hasCipher && (rawCipher.length > MAX_CIPHER_LENGTH || rawNonce.length > MAX_NONCE_LENGTH)) {
          return reply(ack, { ok: false, error: 'MESSAGE_TOO_LONG' });
        }

        if (hasText && rawText.length > MAX_TEXT_LENGTH) {
          return reply(ack, { ok: false, error: 'MESSAGE_TOO_LONG' });
        }

        const conversation = await getAcceptedConversation(userId, recipientId);

        if (!conversation) {
          return reply(ack, { ok: false, error: 'NOT_CONNECTED' });
        }

        const recipientExists = await User.exists({ _id: recipientId });

        if (!recipientExists) {
          return reply(ack, { ok: false, error: 'RECIPIENT_NOT_FOUND' });
        }

        const text = hasText ? rawText.trim().slice(0, MAX_TEXT_LENGTH) : null;
        const cipher = hasCipher ? rawCipher.trim().slice(0, MAX_CIPHER_LENGTH) : null;
        const nonce = hasCipher ? rawNonce.trim().slice(0, MAX_NONCE_LENGTH) : null;
        const alg = hasCipher ? rawAlg.trim().slice(0, MAX_ALG_LENGTH) : null;

        const { message, created } = await persistMessage({
          senderId: userId,
          recipientId,
          text,
          cipher,
          nonce,
          alg,
          clientMessageId: clientMessageId.trim(),
        });

        const out = serializeMessage(message);

        socket.join(conversationRoom(message.conversationId));

        if (created) {
          await Conversation.updateOne(
            { pairKey: message.conversationId },
            { $set: { lastMessageAt: message.createdAt } }
          );

          io.to(conversationRoom(message.conversationId)).emit('message:new', out);
          io
            .to(userRoom(recipientId))
            .except(conversationRoom(message.conversationId))
            .emit('message:new', out);
        } else {
          io.to(userRoom(recipientId)).emit('message:new', out);
        }

        return reply(ack, { ok: true, message: out });
      } catch (err) {
        console.error('[socket] message:send failed', err);
        return reply(ack, { ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on('message:delivered', async (payload, ack) => {
      try {
        const messageId = payload && payload.messageId;

        if (!mongoose.isValidObjectId(messageId)) {
          return reply(ack, { ok: false, error: 'INVALID_MESSAGE' });
        }

        const result = await transitionDelivered(messageId, userId);

        if (result.error) {
          return reply(ack, { ok: false, error: result.error });
        }

        if (result.changed) {
          broadcastStatus(io, result.message);
        }

        return reply(ack, { ok: true, status: result.message.status, changed: result.changed });
      } catch (err) {
        console.error('[socket] message:delivered failed', err);
        return reply(ack, { ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on('conversation:read', async (payload, ack) => {
      try {
        const otherId = payload && payload.otherId;

        if (!mongoose.isValidObjectId(otherId)) {
          return reply(ack, { ok: false, error: 'INVALID_PAYLOAD' });
        }

        const conversation = await getAcceptedConversation(userId, otherId);

        if (!conversation) {
          return reply(ack, { ok: false, error: 'NOT_CONNECTED' });
        }

        const conversationId = conversation.pairKey;

        const { updatedIds } = await readConversation(conversationId, userId);

        const at = new Date();

        for (const messageId of updatedIds) {
          const event = {
            _id: messageId,
            conversationId,
            status: 'read',
            deliveredAt: null,
            readAt: at,
          };

          io.to(conversationRoom(conversationId)).emit('message:status', serializeStatusEvent(event));
          io
            .to(userRoom(otherId))
            .except(conversationRoom(conversationId))
            .emit('message:status', serializeStatusEvent(event));
        }

        return reply(ack, { ok: true, updated: updatedIds.length, messageIds: updatedIds });
      } catch (err) {
        console.error('[socket] conversation:read failed', err);
        return reply(ack, { ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);

      const { wentOffline } = presence.remove(userId, socket.id);

      if (wentOffline) {
        scheduleOffline(io, userId);
      }
    });
  });
};
