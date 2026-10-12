const Conversation = require('../models/Conversation');
const ChatRequest = require('../models/ChatRequest');
const { getPairKey } = require('./conversation');

async function getAcceptedConversation(userId, otherId) {
  const pairKey = getPairKey(userId, otherId);

  return Conversation.findOne({
    pairKey,
    participants: { $all: [userId, otherId] },
  });
}

async function isConnected(userId, otherId) {
  const conversation = await getAcceptedConversation(userId, otherId);

  return Boolean(conversation);
}

async function getRelationshipState(userId, otherId) {
  if (String(userId) === String(otherId)) {
    return 'self';
  }

  const conversation = await getAcceptedConversation(userId, otherId);

  if (conversation) {
    return 'accepted';
  }

  const request = await ChatRequest.findOne({ pairKey: getPairKey(userId, otherId) });

  if (!request) {
    return 'none';
  }

  if (request.status === 'rejected') {
    return 'rejected';
  }

  if (request.status === 'accepted') {
    return 'accepted';
  }

  return String(request.requester) === String(userId) ? 'pending_out' : 'pending_in';
}

module.exports = { getAcceptedConversation, isConnected, getRelationshipState };
