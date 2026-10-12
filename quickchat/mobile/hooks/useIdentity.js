import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as api from '../services/api';

const STORAGE_KEY = 'quickchat.session';

const IdentityContext = createContext(null);

export function IdentityProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (raw) {
          const session = JSON.parse(raw);

          if (session && session.token && session.user) {
            api.setAuthToken(session.token);

            if (active) {
              setToken(session.token);
              setUser(session.user);
            }
          }
        }
      } catch (err) {
        console.warn('[auth] failed to restore session', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (nextToken, nextUser) => {
    api.setAuthToken(nextToken);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const signIn = useCallback(
    async ({ username, password }) => {
      const result = await api.login({ username, password });

      await persist(result.token, result.user);

      return result.user;
    },
    [persist]
  );

  const signUp = useCallback(
    async ({ username, displayName, password }) => {
      const result = await api.register({ username, displayName, password });

      await persist(result.token, result.user);

      return result.user;
    },
    [persist]
  );

  const signOut = useCallback(async () => {
    api.setAuthToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async ({ displayName }) => {
    const updated = await api.updateMe({ displayName });

    setUser(updated);

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw) {
        const session = JSON.parse(raw);
        session.user = updated;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
    } catch (err) {
      console.warn('[auth] failed to persist profile update', err);
    }

    return updated;
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, signIn, signUp, signOut, updateProfile, setUser }),
    [user, token, loading, signIn, signUp, signOut, updateProfile]
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const context = useContext(IdentityContext);

  if (!context) {
    throw new Error('useIdentity must be used inside IdentityProvider');
  }

  return context;
}
