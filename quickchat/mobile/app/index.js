import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';

import { useCrypto } from '../hooks/useCrypto';
import { useIdentity } from '../hooks/useIdentity';
import { useNotepad } from '../hooks/useNotepad';
import { useNotes } from '../hooks/useNotes';
import { saveIdentity, verifySecretKey } from '../services/api';

const LOGO = require('../assets/images/quickchat-icon.png');

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function looksLikeSecretKey(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 8 || value.length > 128) return false;
  if (/\s/.test(value)) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
}

function noteTitle(note) {
  if (note.locked) return 'Locked note';

  const title = (note.title || '').trim();

  if (title) return title;

  const line = (note.content || '').split('\n').find((item) => item.trim());

  return line ? line.trim().slice(0, 40) : 'Untitled note';
}

export default function NotepadScreen() {
  const router = useRouter();
  const { user, loading, applyUser } = useIdentity();
  const { notepadMode, markUnlocked } = useNotepad();
  const { unlock, provision, decryptNote, unlocked } = useCrypto();

  const userId = user ? user._id : 'anon';
  const remote = Boolean(user);

  const { notes, loading: notesLoading, error, reload, saveNote, removeNote } = useNotes(
    userId,
    remote
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [allowSaveAsNote, setAllowSaveAsNote] = useState(false);

  const canEnterKey = Boolean(user && notepadMode && user.hasSecretKey);
  const showKeyButton = !user || !user.hasSecretKey;
  const canTryUnlock =
    canEnterKey && !allowSaveAsNote && looksLikeSecretKey(draft ? draft.title.trim() : '');

  const openNew = useCallback(() => {
    setDraft({ _id: null, title: '', content: '' });
    setSaveError(null);
    setAllowSaveAsNote(false);
    setEditorOpen(true);
  }, []);

  const openNote = useCallback((note) => {
    if (note.locked) {
      Alert.alert(
        'Locked note',
        'Enter your secret key first. Tap the new note button and use your secret key as the heading to unlock.'
      );
      return;
    }

    setDraft({ _id: note._id, title: note.title, content: note.content });
    setSaveError(null);
    setAllowSaveAsNote(false);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setDraft(null);
    setSaveError(null);
    setAllowSaveAsNote(false);
  }, []);

  const commit = useCallback(async () => {
    if (!draft) return;

    if (!draft.title.trim() && !draft.content.trim()) {
      closeEditor();
      return;
    }

    if (canTryUnlock) {
      setSaving(true);
      setSaveError(null);

      try {
        const secretKey = draft.title.trim();
        const body = await verifySecretKey({ secretKey });
        const identity = body && body.identity;

        if (identity && identity.kdfSalt && identity.keyBackup) {
          unlock({ secretKey, kdfSalt: identity.kdfSalt, keyBackup: identity.keyBackup });
        } else {
          const bundle = provision(secretKey);
          const updated = await saveIdentity(bundle);

          await applyUser(updated);
        }

        setDraft(null);
        setEditorOpen(false);
        setSaveError(null);
        markUnlocked();
        router.replace('/chats');
        return;
      } catch (err) {
        setAllowSaveAsNote(true);
        setSaving(false);
        setSaveError(
          'That heading was not accepted. Edit the heading, or press Save again to keep it as a note.'
        );
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      await saveNote(draft);
      closeEditor();
    } catch (err) {
      setSaveError(err.message || 'Could not save the note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [draft, saveNote, closeEditor, canTryUnlock, markUnlocked, router, unlock, provision, applyUser]);

  const remove = useCallback(async () => {
    if (!draft || !draft._id) return;

    setSaving(true);
    setSaveError(null);

    try {
      await removeNote(draft._id);
      closeEditor();
    } catch (err) {
      setSaveError(err.message || 'Could not delete the note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [draft, removeNote, closeEditor]);

  const data = useMemo(
    () =>
      notes.map((note) => {
        if (!note.encrypted) return note;

        const decrypted = decryptNote(note);

        if (!decrypted) return { ...note, locked: true, title: '', content: '' };

        return { ...note, title: decrypted.title, content: decrypted.content };
      }),
    [notes, decryptNote, unlocked]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (user && !notepadMode) {
    return <Redirect href="/chats" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onLongPress={() => router.push('/recovery')}
          delayLongPress={650}
          activeOpacity={0.8}
        >
          <Image source={LOGO} style={styles.logo} />
        </TouchableOpacity>
        <Text style={styles.brand}>NotApp</Text>
        <View style={styles.spacer} />
        {showKeyButton ? (
          <TouchableOpacity
            style={styles.gateBtn}
            onPress={() => router.push('/unlock')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.gateIcon}>🔑</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {notesLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onRefresh={reload}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptyText}>Tap the + button to write your first note.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openNote(item)}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {noteTitle(item)}
              </Text>
              <Text style={styles.rowPreview} numberOfLines={2}>
                {item.locked
                  ? '🔒 Enter your secret key to read this note'
                  : item.content
                    ? item.content.trim()
                    : 'No additional text'}
              </Text>
              <Text style={styles.rowDate}>{formatDate(item.updatedAt || item.createdAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {error ? (
        <View style={styles.syncBar}>
          <Text style={styles.syncText}>Showing saved notes. Sync unavailable right now.</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.9}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={closeEditor} disabled={saving}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.editorHeading}>{draft && draft._id ? 'Edit note' : 'New note'}</Text>
              <TouchableOpacity onPress={commit} disabled={saving}>
                <Text style={[styles.saveAction, saving && styles.disabledText]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              placeholder="Enter a note title"
              placeholderTextColor="#9ca3af"
              value={draft ? draft.title : ''}
              onChangeText={(value) => {
                setDraft((prev) => ({ ...prev, title: value }));
                setAllowSaveAsNote(false);
              }}
              maxLength={128}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
            />

            <TextInput
              style={styles.contentInput}
              placeholder="Start writing…"
              placeholderTextColor="#9ca3af"
              value={draft ? draft.content : ''}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, content: value }))}
              multiline
              textAlignVertical="top"
              maxLength={10000}
              editable={!saving}
            />

            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

            {draft && draft._id ? (
              <TouchableOpacity style={styles.deleteBtn} onPress={remove} disabled={saving}>
                <Text style={styles.deleteText}>Delete note</Text>
              </TouchableOpacity>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fdfcf8',
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdfcf8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ece9e0',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  spacer: {
    flex: 1,
  },
  gateBtn: {
    padding: 4,
  },
  gateIcon: {
    fontSize: 18,
  },
  list: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ece9e0',
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  rowPreview: {
    fontSize: 13,
    color: '#6b7280',
  },
  rowDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  syncBar: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  syncText: {
    color: '#92400e',
    fontSize: 12,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 34,
    marginTop: -2,
  },
  editorSafe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ece9e0',
  },
  cancel: {
    color: '#6b7280',
    fontWeight: '600',
  },
  editorHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  saveAction: {
    color: '#2563eb',
    fontWeight: '700',
  },
  disabledText: {
    opacity: 0.5,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingHorizontal: 16,
    paddingTop: 8,
    lineHeight: 22,
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  deleteBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
});
