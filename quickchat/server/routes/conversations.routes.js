const express = require('express');
const mongoose = require('mongoose');

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const presence = require('../presence');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { serializeMessage, serializePublicUser } = require('../utils/serialize');
const { getAcceptedConversation } = require('../utils/relationship');
const { encodeCursor, decodeCursor, buildKeysetFilter } = require('../utils/cursor');

const router = express.Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimit(value) {
  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ participants: req.userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100);

    const otherIds = conversations
      .map((conv) => conv.participants.find((id) => String(id) !== String(req.userId)))
      .filter(Boolean);

    const users = await User.find({ _id: { $in: otherIds } });
    const byId = new Map(users.map((user) => [String(user._id), user]));

    const results = [];

    for (const conv of conversations) {
      const otherId = conv.participants.find((id) => String(id) !== String(req.userId));

      if (!otherId) continue;

      const other = byId.get(String(otherId));

      const lastMessage = await Message.findOne({ conversationId: conv.pairKey }).sort({
        createdAt: -1,
        _id: -1,
      });

      const unreadCount = await Message.countDocuments({
        conversationId: conv.pairKey,
        recipientId: req.userId,
        status: { $ne: 'read' },
      });

      results.push({
        conversationId: conv.pairKey,
        user: serializePublicUser(other, other ? presence.isOnline(other._id) : false),
        lastMessage: lastMessage ? serializeMessage(lastMessage) : null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount,
      });
    }

    return res.json({ conversations: results });
  })
);

router.get(
  '/:otherId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { otherId } = req.params;

    if (!mongoose.isValidObjectId(otherId)) {
      throw new HttpError(400, 'Invalid user id', 'INVALID_USER');
    }

    const conversation = await getAcceptedConversation(req.userId, otherId);

    if (!conversation) {
      throw new HttpError(403, 'You are not connected with this user', 'NOT_CONNECTED');
    }

    const limit = parseLimit(req.query.limit);

    const before = decodeCursor(req.query.before);
    const after = decodeCursor(req.query.after);

    if (req.query.before && !before) {
      throw new HttpError(400, 'Invalid before cursor', 'INVALID_CURSOR');
    }

    if (req.query.after && !after) {
      throw new HttpError(400, 'Invalid after cursor', 'INVALID_CURSOR');
    }

    if (before && after) {
      throw new HttpError(400, 'Provide either before or after, not both', 'INVALID_CURSOR');
    }

    const filter = { conversationId: conversation.pairKey };
    let direction = 'desc';

    if (before) {
      Object.assign(filter, buildKeysetFilter(before, 'before'));
    } else if (after) {
      Object.assign(filter, buildKeysetFilter(after, 'after'));
      direction = 'asc';
    }

    const sort = direction === 'asc' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };

    const docs = await Message.find(filter).sort(sort).limit(limit + 1);

    const hasMore = docs.length > limit;

    if (hasMore) {
      docs.pop();
    }

    const ordered = direction === 'asc' ? docs : docs.reverse();
    const messages = ordered.map(serializeMessage);

    const nextCursor = messages.length ? encodeCursor(ordered[0]) : null;
    const latestCursor = messages.length ? encodeCursor(ordered[ordered.length - 1]) : null;

    return res.json({
      conversationId: conversation.pairKey,
      messages,
      nextCursor,
      latestCursor,
      hasMore,
    });
  })
);

module.exports = router;
