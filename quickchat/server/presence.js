const connections = new Map();

function add(userId, socketId) {
  const key = String(userId);
  let sockets = connections.get(key);

  if (!sockets) {
    sockets = new Set();
    connections.set(key, sockets);
  }

  const wasEmpty = sockets.size === 0;
  sockets.add(socketId);

  return { becameOnline: wasEmpty, connections: sockets.size };
}

function remove(userId, socketId) {
  const key = String(userId);
  const sockets = connections.get(key);

  if (!sockets) {
    return { wentOffline: false, connections: 0 };
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    connections.delete(key);

    return { wentOffline: true, connections: 0 };
  }

  return { wentOffline: false, connections: sockets.size };
}

function isOnline(userId) {
  const sockets = connections.get(String(userId));

  return Boolean(sockets && sockets.size > 0);
}

function onlineUserIds() {
  return Array.from(connections.keys());
}

function drop(userId) {
  connections.delete(String(userId));
}

module.exports = { add, remove, isOnline, onlineUserIds, drop };
