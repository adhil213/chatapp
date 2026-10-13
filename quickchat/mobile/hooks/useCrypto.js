import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useIdentity } from './useIdentity';
import * as keys from '../services/keys';
import * as crypto from '../services/crypto';

const CryptoContext = createContext(null);

export function CryptoProvider({ children }) {
  const { user } = useIdentity();
  const [unlocked, setUnlocked] = useState(keys.isUnlocked());

  useEffect(() => {
    const unsubscribe = keys.subscribe((next) => setUnlocked(Boolean(next)));

    setUnlocked(keys.isUnlocked());

    return unsubscribe;
  }, [user && user._id]);

  const unlock = useCallback(
    ({ secretKey, kdfSalt, keyBackup, userId } = {}) => {
      const salt = kdfSalt || (user && user.kdfSalt);
      const backup = keyBackup || (user && user.keyBackup);
      const id = userId || (user && user._id);

      if (!id || !salt || !backup || !secretKey) return false;

      return keys.unlockKeys({ userId: id, secretKey, kdfSalt: salt, keyBackup: backup });
    },
    [user]
  );

  const provision = useCallback(
    (secretKey) => keys.provisionKeys(secretKey, user && user._id),
    [user]
  );

  const rewrap = useCallback(
    (params) => keys.rewrapBackup(params),
    []
  );

  const value = useMemo(
    () => ({
      supported: crypto.isSupported(),
      unlocked,
      unlock,
      provision,
      rewrap,
      lock: keys.lockKeys,
      encryptMessage: keys.encryptMessage,
      decryptMessage: keys.decryptMessage,
      encryptNote: keys.encryptNote,
      decryptNote: keys.decryptNote,
    }),
    [unlocked, unlock, provision, rewrap]
  );

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}

export function useCrypto() {
  const context = useContext(CryptoContext);

  if (!context) {
    throw new Error('useCrypto must be used inside CryptoProvider');
  }

  return context;
}
