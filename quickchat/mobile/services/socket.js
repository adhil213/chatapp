import { io } from 'socket.io-client';

import { SOCKET_URL } from './config';

const ACK_TIMEOUT = 8000;

let socket = null;

export function connectSocket(token) {
  if (socket) {
    socket.auth = { token };

    if (!socket.connected && !socket.active) {
      socket.connect();
    }

    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function emitWithAck(socketInstance, event, payload) {
  return new Promise((resolve, reject) => {
    const target = socketInstance || socket;

    if (!target) {
      reject(new Error('Socket not initialised'));
      return;
    }

    target.timeout(ACK_TIMEOUT).emit(event, payload, (err, response) => {
      if (err) {
        reject(new Error(`No acknowledgement for "${event}"`));
        return;
      }

      resolve(response);
    });
  });
}
