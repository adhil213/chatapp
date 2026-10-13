import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { useIdentity } from '../hooks/useIdentity';
import { useNotepad } from '../hooks/useNotepad';
import { useNotes } from '../hooks/useNotes';

const LOGO = require('../assets/images/quickchat-icon.png');

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function noteTitle(note) {
  const title = (note.title || '').trim();

  if (title) return title;

  const line = (note.content || '').split('\n').find((item) => item.trim());

  return line ? line.trim().slice(0, 40) : 'Untitled note';
}

export default function NotepadScreen() {
  const router = useRouter();
  const { user, loading } = useIdentity();
  const { notepadMode } = useNotepad();

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

  const openNew = useCallback(() => {
    setDraft({ _id: null, title: '', content: '' });
    setSaveError(null);
    setEditorOpen(true);
  }, []);

  const openNote = useCallback((note) => {
    setDraft({ _id: note._id, title: note.title || '', content: note.content || '' });
    setSaveError(null);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setDraft(null);
    setSaveError(null);
  }, []);

  const commit = useCallback(async () => {
    if (!draft) return;

    if (!draft.title.trim() && !draft.content.trim()) {
      closeEditor();
      return;
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
  }, [draft, saveNote, closeEditor]);

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

  const data = useMemo(() => notes, [notes]);

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
        <TouchableOpacity
          style={styles.gateBtn}
          onPress={() => router.push('/unlock')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.gateIcon}>🔑</Text>
        </TouchableOpacity>
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
                {item.content ? item.content.trim() : 'No additional text'}
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
              placeholder="Title"
              placeholderTextColor="#9ca3af"
              value={draft ? draft.title : ''}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, title: value }))}
              maxLength={80}
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
