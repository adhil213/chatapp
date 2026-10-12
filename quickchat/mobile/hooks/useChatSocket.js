import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useIdentity } from './useIdentity';
import { connectSocket, emitWithAck, disconnectSocket } from '../services/socket';

const ChatSocketContext = createContext(null);

export function ChatSocketProvider({ children }) {
  const { user, token, signOut } = useIdentity();
  const selfId = user ? user._id : null;

  const [status, setStatus] = useState('connecting');
  const [ready, setReady] = useState(false);
  const [presence, setPresence] = useState({});

  const listenersRef = useRef(new Set());
  const joinedRef = useRef(new Set());
  const socketRef = useRef(null);
  const signOutRef = useRef(signOut);

  signOutRef.current = signOut;

  const emitToListeners = useCallback((event) => {
    for (const listener of listenersRef.current) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[socket] listener error', err);
      }
    }
  }, []);

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);

    return () => listenersRef.current.delete(listener);
  }, []);

  const applyPresenceUpdate = useCallback((payload) => {
    setPresence((prev) => ({
      ...prev,
      [payload.userId]: {
        online: payload.online,
        lastSeen: payload.online
          ? null
          : payload.lastSeen || (prev[payload.userId] && prev[payload.userId].lastSeen) || null,
      },
    }));
  }, []);

  const applyPresenceSnapshot = useCallback((payload) => {
    const listed = new Set(payload.onlineUserIds || []);

    setPresence((prev) => {
      const next = {};

      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key], online: listed.has(key) };
      }

      for (const id of listed) {
        next[id] = { ...(next[id] || {}), online: true };
      }

      return next;
    });
  }, []);

  const seedPresence = useCallback((users) => {
    setPresence((prev) => {
      const next = { ...prev };

      for (const user of users) {
        const existing = next[user._id];

        next[user._id] = {
          online: Boolean(user.online),
          lastSeen: user.online
            ? (existing && existing.lastSeen) || null
            : user.lastSeen || (existing && existing.lastSeen) || null,
        };
      }

      return next;
    });
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      joinedRef.current.clear();
      setStatus('connecting');
      setReady(false);
      setPresence({});
      return undefined;
    }

    let active = true;
    const socket = connectSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      if (!active) return;

      setStatus('connected');
      setReady(true);

      for (const otherId of joinedRef.current) {
        emitWithAck(socket, 'conversation:join', { otherId }).catch(() => {});
      }

      emitToListeners({ type: 'ready' });
    };

    const onDisconnect = () => {
      if (!active) return;
      setStatus('disconnected');
      setReady(false);
      emitToListeners({ type: 'connection', status: 'disconnected' });
    };

    const onConnectError = (err) => {
      if (!active) return;

      if (err && /unauthorized/i.test(err.message || '')) {
        emitToListeners({ type: 'unauthorized' });
        signOutRef.current();
        return;
      }

      setStatus('disconnected');
      setReady(false);
      emitToListeners({ type: 'connection', status: 'disconnected' });
    };

    const onReconnectAttempt = () => {
      if (!active) return;
      setStatus('connecting');
      emitToListeners({ type: 'connection', status: 'connecting' });
    };

    const onMessage = (message) => {
      if (!active) return;

      emitToListeners({ type: 'message', message });
    };

    const onStatus = (payload) => {
      if (!active) return;
      emitToListeners({ type: 'status', ...payload });
    };

    const onPresence = (payload) => {
      if (!active) return;
      applyPresenceUpdate(payload);
    };

    const onPresenceSnapshot = (payload) => {
      if (!active) return;
      applyPresenceSnapshot(payload);
    };

    const onRequestNew = (payload) => {
      if (!active) return;
      emitToListeners({ type: 'request:new', request: payload });
    };

    const onRequestUpdated = (payload) => {
      if (!active) return;
      emitToListeners({ type: 'request:updated', ...payload });
    };

    const onConversationNew = (payload) => {
      if (!active) return;
      emitToListeners({ type: 'conversation:new', ...payload });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessage);
    socket.on('message:status', onStatus);
    socket.on('presence:update', onPresence);
    socket.on('presence:snapshot', onPresenceSnapshot);
    socket.on('request:new', onRequestNew);
    socket.on('request:updated', onRequestUpdated);
    socket.on('conversation:new', onConversationNew);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      active = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessage);
      socket.off('message:status', onStatus);
      socket.off('presence:update', onPresence);
      socket.off('presence:snapshot', onPresenceSnapshot);
      socket.off('request:new', onRequestNew);
      socket.off('request:updated', onRequestUpdated);
      socket.off('conversation:new', onConversationNew);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, [token, emitToListeners, applyPresenceUpdate, applyPresenceSnapshot]);

  const joinConversation = useCallback(async (otherId) => {
    const socket = socketRef.current || (token ? connectSocket(token) : null);

    if (!socket) return null;

    socketRef.current = socket;
    joinedRef.current.add(otherId);

    try {
      const res = await emitWithAck(socket, 'conversation:join', { otherId });

      return res && res.conversationId;
    } catch (err) {
      return null;
    }
  }, [token]);

  const sendMessage = useCallback((payload) => {
    const socket = socketRef.current;

    if (!socket) {
      return Promise.resolve({ ok: false, error: 'OFFLINE' });
    }

    return emitWithAck(socket, 'message:send', payload);
  }, []);

  const markDelivered = useCallback((messageId) => {
    const socket = socketRef.current;

    if (!socket) return Promise.resolve(null);

    return emitWithAck(socket, 'message:delivered', { messageId }).catch(() => null);
  }, []);

  const markRead = useCallback((otherId) => {
    const socket = socketRef.current;

    if (!socket) return Promise.resolve(null);

    return emitWithAck(socket, 'conversation:read', { otherId }).catch(() => null);
  }, []);

  const getPresence = useCallback((userId) => presence[userId] || null, [presence]);

  const value = useMemo(
    () => ({
      status,
      ready,
      selfId,
      presence,
      getPresence,
      seedPresence,
      subscribe,
      joinConversation,
      sendMessage,
      markDelivered,
      markRead,
    }),
    [
      status,
      ready,
      selfId,
      presence,
      getPresence,
      seedPresence,
      subscribe,
      joinConversation,
      sendMessage,
      markDelivered,
      markRead,
    ]
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}

export function useChatSocket() {
  const context = useContext(ChatSocketContext);

  if (!context) {
    throw new Error('useChatSocket must be used inside ChatSocketProvider');
  }

  return context;
}
