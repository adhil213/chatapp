let ioRef = null;

function setIo(io) {
  ioRef = io;
}

function getIo() {
  return ioRef;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function emitToUser(userId, event, payload) {
  if (ioRef) {
    ioRef.to(userRoom(userId)).emit(event, payload);
  }
}

module.exports = { setIo, getIo, userRoom, emitToUser };
