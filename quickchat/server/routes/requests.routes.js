const express = require('express');
const mongoose = require('mongoose');

const ChatRequest = require('../models/ChatRequest');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { getPairKey } = require('../utils/conversation');
const { serializeRequest, serializePublicUser } = require('../utils/serialize');
const { normalizeUsername } = require('../utils/username');
const { emitToUser } = require('../realtime');

const router = express.Router();

async function resolveTarget(body) {
  if (body && mongoose.isValidObjectId(body.userId)) {
    const user = await User.findById(body.userId);

    return user;
  }

  const username = normalizeUsername(body && body.username);

  if (username) {
    return User.findOne({ username });
  }

  return null;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [incomingDocs, outgoingDocs] = await Promise.all([
      ChatRequest.find({ recipient: req.userId, status: 'pending' })
        .sort({ createdAt: -1 })
        .populate('requester'),
      ChatRequest.find({ requester: req.userId, status: 'pending' })
        .sort({ createdAt: -1 })
        .populate('recipient'),
    ]);

    const incoming = incomingDocs.map((doc) =>
      serializeRequest(doc, doc.requester, 'incoming')
    );

    const outgoing = outgoingDocs.map((doc) =>
      serializeRequest(doc, doc.recipient, 'outgoing')
    );

    return res.json({ incoming, outgoing });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const target = await resolveTarget(req.body);

    if (!target) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (String(target._id) === String(req.userId)) {
      throw new HttpError(400, 'You cannot send a request to yourself', 'SELF_REQUEST');
    }

    const pairKey = getPairKey(req.userId, target._id);

    const existingConversation = await Conversation.findOne({ pairKey });

    if (existingConversation) {
      throw new HttpError(409, 'You are already connected', 'ALREADY_CONNECTED');
    }

    let request = await ChatRequest.findOne({ pairKey });

    if (request) {
      if (request.status === 'pending') {
        throw new HttpError(409, 'A request is already pending', 'ALREADY_PENDING');
      }

      if (request.status === 'accepted') {
        throw new HttpError(409, 'You are already connected', 'ALREADY_CONNECTED');
      }

      request.requester = req.userId;
      request.recipient = target._id;
      request.status = 'pending';
      request.respondedAt = null;

      await request.save();
    } else {
      try {
        request = await ChatRequest.create({
          pairKey,
          requester: req.userId,
          recipient: target._id,
          status: 'pending',
        });
      } catch (err) {
        if (err && err.code === 11000) {
          throw new HttpError(409, 'A request is already pending', 'ALREADY_PENDING');
        }

        throw err;
      }
    }

    emitToUser(target._id, 'request:new', serializeRequest(request, req.user, 'incoming'));

    return res.status(201).json({ request: serializeRequest(request, target, 'outgoing') });
  })
);

async function loadPendingRequestForRecipient(req) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid request id', 'INVALID_REQUEST');
  }

  const request = await ChatRequest.findById(req.params.id);

  if (!request) {
    throw new HttpError(404, 'Request not found', 'NOT_FOUND');
  }

  if (String(request.recipient) !== String(req.userId)) {
    throw new HttpError(403, 'You cannot respond to this request', 'FORBIDDEN');
  }

  return request;
}

router.post(
  '/:id/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadPendingRequestForRecipient(req);

    if (request.status === 'rejected') {
      throw new HttpError(409, 'This request was already rejected', 'INVALID_TRANSITION');
    }

    if (request.status !== 'accepted') {
      request.status = 'accepted';
      request.respondedAt = new Date();

      await request.save();
    }

    const pairKey = getPairKey(request.requester, request.recipient);

    const conversation = await Conversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { pairKey, participants: [request.requester, request.recipient] } },
      { upsert: true, new: true }
    );

    const [requesterUser, recipientUser] = await Promise.all([
      User.findById(request.requester),
      User.findById(request.recipient),
    ]);

    emitToUser(request.requester, 'conversation:new', {
      conversationId: pairKey,
      user: serializePublicUser(recipientUser),
    });

    emitToUser(request.requester, 'request:updated', {
      requestId: String(request._id),
      status: 'accepted',
    });

    emitToUser(request.recipient, 'conversation:new', {
      conversationId: pairKey,
      user: serializePublicUser(requesterUser),
    });

    return res.json({
      request: serializeRequest(request, requesterUser, 'incoming'),
      conversationId: conversation.pairKey,
    });
  })
);

router.post(
  '/:id/reject',
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadPendingRequestForRecipient(req);

    if (request.status === 'accepted') {
      throw new HttpError(409, 'This request was already accepted', 'INVALID_TRANSITION');
    }

    if (request.status !== 'rejected') {
      request.status = 'rejected';
      request.respondedAt = new Date();

      await request.save();
    }

    const requesterUser = await User.findById(request.requester);

    emitToUser(request.requester, 'request:updated', {
      requestId: String(request._id),
      status: 'rejected',
    });

    return res.json({ request: serializeRequest(request, requesterUser, 'incoming') });
  })
);

module.exports = router;
