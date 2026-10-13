import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useIdentity } from './useIdentity';
import { useChatSocket } from './useChatSocket';
import { getConversationMessages } from '../services/api';
import { createClientMessageId } from '../utils/uuid';

const MAX_TEXT_LENGTH = 2000;
const PAGE_SIZE = 50;
const SYNC_PAGE_SIZE = 100;

const STATUS_RANK = { failed: 0, sending: 0, sent: 1, delivered: 2, read: 3 };

const PERMANENT_ERRORS = new Set([
  'FORBIDDEN',
  'SELF_MESSAGE',
  'EMPTY_MESSAGE',
  'MISSING_CLIENT_MESSAGE_ID',
  'INVALID_PARTICIPANTS',
  'RECIPIENT_NOT_FOUND',
]);

const ERROR_MESSAGES = {
  FORBIDDEN: 'This message could not be sent.',
  SELF_MESSAGE: 'You cannot message yourself.',
  EMPTY_MESSAGE: 'The message was empty.',
  MISSING_CLIENT_MESSAGE_ID: 'The message could not be identified.',
  INVALID_PARTICIPANTS: 'This conversation is no longer valid.',
  RECIPIENT_NOT_FOUND: 'That user no longer exists.',
};

function rank(status) {
  return STATUS_RANK[status] ?? 0;
}

function timeOf(message) {
  const value = new Date(message.createdAt).getTime();

  return Number.isFinite(value) ? value : 0;
}

function compare(a, b) {
  const diff = timeOf(a) - timeOf(b);

  if (diff !== 0) return diff;

  if (a._id && b._id && a._id !== b._id) {
    return String(a._id).localeCompare(String(b._id));
  }

  return String(a.clientMessageId || '').localeCompare(String(b.clientMessageId || ''));
}

function sameMessage(a, b) {
  if (a._id && b._id && a._id === b._id) return true;

  if (
    a.clientMessageId &&
    b.clientMessageId &&
    a.clientMessageId === b.clientMessageId &&
    a.senderId === b.senderId
  ) {
    return true;
  }

  return false;
}

function mergeOne(existing, incoming) {
  const merged = { ...existing, ...incoming };

  if (rank(existing.status) > rank(incoming.status)) {
    merged.status = existing.status;
  }

  return merged;
}

function mergeMessages(list, incoming, pending) {
  if (!incoming || incoming.length === 0) return list;

  const next = list.slice();
  let needsSort = false;
  let tail = next.length ? next[next.length - 1] : null;

  for (const original of incoming) {
    const item = pending === undefined ? original : { ...original, pending };
    const index = next.findIndex((existing) => sameMessage(existing, item));

    if (index === -1) {
      if (tail && compare(item, tail) < 0) {
        needsSort = true;
      }

      next.push(item);
      tail = item;
    } else {
      next[index] = mergeOne(next[index], item);
    }
  }

  if (needsSort) {
    next.sort(compare);
  }

  return next;
}

export function useChat(recipientId) {
  const { user } = useIdentity();
  const selfId = user ? user._id : null;

  const { subscribe, joinConversation, sendMessage, markDelivered, markRead } = useChatSocket();

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const pendingRef = useRef(new Map());
  const inFlightRef = useRef(new Set());
  const oldestCursorRef = useRef(null);
  const latestCursorRef = useRef(null);
  const loadedRef = useRef(false);
  const syncingRef = useRef(false);
  const focusedRef = useRef(false);

  const requestRead = useCallback(() => {
    markRead(recipientId);
  }, [recipientId, markRead]);

  const ackDelivered = useCallback(
    (list) => {
      for (const message of list) {
        if (message.recipientId === selfId && message.status === 'sent') {
          markDelivered(message._id);
        }
      }
    },
    [selfId, markDelivered]
  );

  const rollback = useCallback((clientMessageId) => {
    setMessages((prev) =>
      prev.filter(
        (m) => !(m.clientMessageId === clientMessageId && m.senderId === selfId && !m._id)
      )
    );
  }, [selfId]);

  const markFailed = useCallback(
    (clientMessageId) => {
      setMessages((prev) =>
        mergeMessages(
          prev,
          [{ clientMessageId, senderId: selfId, status: 'failed' }],
          true
        )
      );
    },
    [selfId]
  );

  const deliver = useCallback(
    async (payload) => {
      const { clientMessageId } = payload;

      if (inFlightRef.current.has(clientMessageId)) {
        return false;
      }

      inFlightRef.current.add(clientMessageId);

      try {
        const response = await sendMessage(payload);

        if (response && response.ok && response.message) {
          pendingRef.current.delete(clientMessageId);
          setConversationId(response.message.conversationId);
          setMessages((prev) => mergeMessages(prev, [response.message], false));
          return true;
        }

        const code = response && response.error;

        if (PERMANENT_ERRORS.has(code)) {
          pendingRef.current.delete(clientMessageId);
          rollback(clientMessageId);
          setError(new Error(ERROR_MESSAGES[code] || 'This message could not be sent.'));
          return false;
        }

        markFailed(clientMessageId);
        return false;
      } catch (err) {
        markFailed(clientMessageId);
        return false;
      } finally {
        inFlightRef.current.delete(clientMessageId);
      }
    },
    [sendMessage, markFailed, rollback]
  );

  const flushPending = useCallback(async () => {
    const entries = Array.from(pendingRef.current.values());

    for (const payload of entries) {
      await deliver(payload);
    }
  }, [deliver]);

  const clearChat = useCallback(() => {
    pendingRef.current.clear();
    inFlightRef.current.clear();
    oldestCursorRef.current = null;
    latestCursorRef.current = null;
    loadedRef.current = false;
    setMessages([]);
    setHasMore(false);
    setError(null);
  }, []);

  const applyStatus = useCallback((messageId, status) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m._id === messageId);

      if (index === -1) return prev;

      const next = prev.slice();
      next[index] = mergeOne(next[index], { status });

      return next;
    });
  }, []);

  const loadInitial = useCallback(async () => {
    if (!selfId || !recipientId) return;

    const result = await getConversationMessages({ otherId: recipientId, limit: PAGE_SIZE });

    setConversationId(result.conversationId);
    setMessages((prev) => mergeMessages(prev, result.messages, false));

    oldestCursorRef.current = result.nextCursor;
    latestCursorRef.current = result.latestCursor;
    loadedRef.current = true;
    setHasMore(Boolean(result.hasMore));

    ackDelivered(result.messages);

    if (focusedRef.current) {
      requestRead();
    }
  }, [selfId, recipientId, ackDelivered, requestRead]);

  const loadOlder = useCallback(async () => {
    if (!selfId || !recipientId) return;
    if (!hasMore || loadingMore || !oldestCursorRef.current || !loadedRef.current) return;

    setLoadingMore(true);

    try {
      const result = await getConversationMessages({
        otherId: recipientId,
        limit: PAGE_SIZE,
        before: oldestCursorRef.current,
      });

      setMessages((prev) => mergeMessages(prev, result.messages, false));
      oldestCursorRef.current = result.nextCursor;
      setHasMore(Boolean(result.hasMore));

      ackDelivered(result.messages);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [selfId, recipientId, hasMore, loadingMore, ackDelivered]);

  const syncSinceCursor = useCallback(async () => {
    if (!selfId || !recipientId) return;

    if (!loadedRef.current || !latestCursorRef.current) {
      await loadInitial();
      return;
    }

    if (syncingRef.current) return;

    syncingRef.current = true;

    try {
      let cursor = latestCursorRef.current;
      let guard = 0;

      while (cursor && guard < 50) {
        guard += 1;

        const result = await getConversationMessages({
          otherId: recipientId,
          limit: SYNC_PAGE_SIZE,
          after: cursor,
        });

        if (result.messages.length > 0) {
          setMessages((prev) => mergeMessages(prev, result.messages, false));
          ackDelivered(result.messages);
        }

        cursor = result.latestCursor;

        if (!result.hasMore) break;
      }

      if (cursor) {
        latestCursorRef.current = cursor;
      }

      if (focusedRef.current) {
        requestRead();
      }
    } catch (err) {
      setError(err);
    } finally {
      syncingRef.current = false;
    }
  }, [selfId, recipientId, loadInitial, ackDelivered, requestRead]);

  useEffect(() => {
    if (!selfId || !recipientId) return undefined;

    let active = true;

    setLoading(true);
    setError(null);
    setMessages([]);
    setConversationId(null);
    setHasMore(false);
    pendingRef.current.clear();
    inFlightRef.current.clear();
    oldestCursorRef.current = null;
    latestCursorRef.current = null;
    loadedRef.current = false;

    const involvesBoth = (message) =>
      (message.senderId === selfId && message.recipientId === recipientId) ||
      (message.senderId === recipientId && message.recipientId === selfId);

    const onEvent = (event) => {
      if (!active) return;

      if (event.type === 'ready') {
        flushPending();
        syncSinceCursor();
        return;
      }

      if (event.type === 'message') {
        const message = event.message;

        if (!involvesBoth(message)) return;

        setMessages((prev) => mergeMessages(prev, [message], false));

        if (message.senderId === selfId) {
          pendingRef.current.delete(message.clientMessageId);
        }

        if (message.recipientId === selfId && focusedRef.current) {
          requestRead();
        }

        return;
      }

      if (event.type === 'status') {
        applyStatus(event.messageId, event.status);
        return;
      }

      if (event.type === 'conversation:cleared') {
        const pairKey = [String(selfId), String(recipientId)].sort().join('__');

        if (event.scope === 'all' || event.conversationId === pairKey) {
          clearChat();
        }
      }
    };

    const unsubscribe = subscribe(onEvent);

    joinConversation(recipientId);

    loadInitial()
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    selfId,
    recipientId,
    subscribe,
    joinConversation,
    loadInitial,
    syncSinceCursor,
    flushPending,
    applyStatus,
    requestRead,
    clearChat,
  ]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      requestRead();

      return () => {
        focusedRef.current = false;
      };
    }, [requestRead])
  );

  const sendText = useCallback(
    (text) => {
      const trimmed = (text || '').trim();

      if (!trimmed || !selfId || !recipientId) {
        return false;
      }

      const payload = {
        recipientId,
        text: trimmed.slice(0, MAX_TEXT_LENGTH),
        clientMessageId: createClientMessageId(),
      };

      const optimistic = {
        _id: undefined,
        clientMessageId: payload.clientMessageId,
        conversationId,
        senderId: selfId,
        recipientId,
        text: payload.text,
        status: 'sending',
        createdAt: new Date().toISOString(),
      };

      pendingRef.current.set(payload.clientMessageId, payload);
      setMessages((prev) => mergeMessages(prev, [optimistic], true));
      deliver(payload);

      return true;
    },
    [selfId, recipientId, conversationId, deliver]
  );

  const retry = useCallback(
    (clientMessageId) => {
      const payload = pendingRef.current.get(clientMessageId);

      if (!payload) {
        return Promise.resolve(false);
      }

      return deliver(payload);
    },
    [deliver]
  );

  return {
    messages,
    conversationId,
    loading,
    loadingMore,
    hasMore,
    error,
    sendText,
    retry,
    retryAll: flushPending,
    loadOlder,
    clearChat,
  };
}
