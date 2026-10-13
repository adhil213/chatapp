import { useCallback, useEffect, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as api from '../services/api';

const KEY_PREFIX = 'quickchat.notes.';
const ANON_KEY = `${KEY_PREFIX}anon`;

function storageKey(userId) {
  return `${KEY_PREFIX}${userId || 'anon'}`;
}

async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

async function writeCache(key, notes) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(notes));
  } catch (err) {
    console.warn('[notes] failed to cache notes', err);
  }
}

export function useNotes(userId, remote) {
  const key = storageKey(userId);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const notesRef = useRef([]);

  notesRef.current = notes;

  const persist = useCallback(
    async (next) => {
      setNotes(next);
      await writeCache(key, next);
    },
    [key]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cached = await readCache(key);

    setNotes(cached);

    if (!remote) {
      setLoading(false);
      return;
    }

    try {
      const server = await api.listNotes();

      await persist(server);
    } catch (err) {
      if (cached.length === 0) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [key, remote, persist]);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      const cached = await readCache(key);

      if (!active) return;

      setNotes(cached);

      if (!remote) {
        setLoading(false);
        return;
      }

      try {
        const server = await api.listNotes();

        if (!active) return;

        await writeCache(key, server);
        setNotes(server);
      } catch (err) {
        if (active && cached.length === 0) {
          setError(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [key, remote]);

  const saveNote = useCallback(
    async ({ _id, title, content }) => {
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      const cleanContent = typeof content === 'string' ? content : '';
      const stamp = new Date().toISOString();

      if (!remote) {
        const current = notesRef.current;

        const saved = _id
          ? { ...(current.find((note) => note._id === _id) || {}), _id, title: cleanTitle, content: cleanContent, updatedAt: stamp }
          : { _id: `local-${Date.now()}`, title: cleanTitle, content: cleanContent, createdAt: stamp, updatedAt: stamp };

        const next = _id
          ? current.map((note) => (note._id === _id ? saved : note))
          : [saved, ...current];

        await persist(next);

        return saved;
      }

      if (_id && !String(_id).startsWith('local-')) {
        const updated = await api.updateNote(_id, { title: cleanTitle, content: cleanContent });

        const next = notesRef.current.map((note) => (note._id === updated._id ? updated : note));

        await persist(next);

        return updated;
      }

      const created = await api.createNote({ title: cleanTitle, content: cleanContent });

      const next = [created, ...notesRef.current];

      await persist(next);

      return created;
    },
    [remote, persist]
  );

  const removeNote = useCallback(
    async (_id) => {
      const current = notesRef.current;

      if (remote && _id && !String(_id).startsWith('local-')) {
        await api.deleteNote(_id);
      }

      await persist(current.filter((note) => note._id !== _id));
    },
    [remote, persist]
  );

  return { notes, loading, error, reload, saveNote, removeNote };
}

export async function clearNotesCache(userId) {
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch (err) {
    console.warn('[notes] failed to clear cached notes', err);
  }
}

export async function migrateAnonymousNotes(userId) {
  if (!userId) return;

  try {
    const anon = await readCache(ANON_KEY);

    if (anon.length === 0) return;

    const server = await api.listNotes();

    if (server.length > 0) {
      await AsyncStorage.removeItem(ANON_KEY);
      return;
    }

    for (const note of [...anon].reverse()) {
      await api.createNote({ title: note.title, content: note.content });
    }

    await AsyncStorage.removeItem(ANON_KEY);
  } catch (err) {
    console.warn('[notes] anonymous note migration skipped', err);
  }
}
