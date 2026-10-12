import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'quickchat.identity';

const IdentityContext = createContext(null);

export function IdentityProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && raw) {
          setIdentity(JSON.parse(raw));
        }
      } catch (err) {
        console.warn('[identity] failed to read stored identity', err);
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

  const signIn = useCallback(async (user) => {
    const value = { id: String(user._id), displayName: user.displayName };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setIdentity(value);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIdentity(null);
  }, []);

  const value = useMemo(
    () => ({ identity, loading, signIn, signOut }),
    [identity, loading, signIn, signOut]
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
