function getPairKey(a, b) {
  return [String(a), String(b)].sort().join('__');
}

const getConversationId = getPairKey;

function isParticipant(pairKey, userId) {
  if (typeof pairKey !== 'string') return false;

  return pairKey.split('__').includes(String(userId));
}

module.exports = { getPairKey, getConversationId, isParticipant };
