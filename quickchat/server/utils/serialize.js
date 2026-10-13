function serializeMessage(message) {
  return {
    _id: String(message._id),
    clientMessageId: message.clientMessageId,
    conversationId: message.conversationId,
    senderId: String(message.senderId),
    recipientId: String(message.recipientId),
    text: message.text,
    status: message.status,
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
    createdAt: message.createdAt,
  };
}

function serializeStatusEvent(message) {
  return {
    messageId: String(message._id),
    conversationId: message.conversationId,
    status: message.status,
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
  };
}

function serializePublicUser(user, online) {
  if (!user) return null;

  return {
    _id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    online: Boolean(online),
    lastSeen: user.lastSeen || null,
  };
}

function serializeSelfUser(user, online) {
  const base = serializePublicUser(user, online);

  if (!base) return null;

  return {
    ...base,
    notepadModeEnabled: Boolean(user.notepadModeEnabled),
    hasSecretKey: Boolean(user.hasSecretKey),
  };
}

function serializeNote(note) {
  return {
    _id: String(note._id),
    title: note.title || '',
    content: note.content || '',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function serializeRequest(request, otherUser, direction) {
  return {
    _id: String(request._id),
    status: request.status,
    direction,
    createdAt: request.createdAt,
    respondedAt: request.respondedAt || null,
    user: serializePublicUser(otherUser),
  };
}

module.exports = {
  serializeMessage,
  serializeStatusEvent,
  serializePublicUser,
  serializeSelfUser,
  serializeRequest,
  serializeNote,
};
