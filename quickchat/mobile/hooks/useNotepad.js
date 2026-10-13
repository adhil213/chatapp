import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useIdentity } from './useIdentity';

const NotepadContext = createContext(null);

export function NotepadProvider({ children }) {
  const { user } = useIdentity();
  const userId = user ? user._id : null;

  const [unlocked, setUnlocked] = useState(false);

  const notepadMode = Boolean(user && user.notepadModeEnabled);

  useEffect(() => {
    setUnlocked(false);
  }, [userId, notepadMode]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        setUnlocked(false);
      }
    });

    return () => subscription.remove();
  }, []);

  const markUnlocked = useCallback(() => setUnlocked(true), []);
  const lock = useCallback(() => setUnlocked(false), []);

  const value = useMemo(
    () => ({
      notepadMode,
      unlocked,
      chatAccessible: !notepadMode || unlocked,
      markUnlocked,
      lock,
    }),
    [notepadMode, unlocked, markUnlocked, lock]
  );

  return <NotepadContext.Provider value={value}>{children}</NotepadContext.Provider>;
}

export function useNotepad() {
  const context = useContext(NotepadContext);

  if (!context) {
    throw new Error('useNotepad must be used inside NotepadProvider');
  }

  return context;
}

export function useLockedFromChat() {
  const { notepadMode, unlocked } = useNotepad();

  return notepadMode && !unlocked;
}
