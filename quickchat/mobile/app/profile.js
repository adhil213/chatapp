import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import * as api from '../services/api';

function validateSecretKey(value) {
  if (!value) return 'Secret key is required.';
  if (/\s/.test(value)) return 'Secret key cannot contain spaces.';
  if (value.length < 8 || value.length > 128) return 'Secret key must be 8-128 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Secret key must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Secret key must include at least one number.';
  return null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, signOut, applyUser } = useIdentity();
  const { notepadMode, unlocked, markUnlocked } = useNotepad();

  const [displayName, setDisplayName] = useState(user ? user.displayName : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [updatingMode, setUpdatingMode] = useState(false);
  const [modeMessage, setModeMessage] = useState(null);
  const [modeError, setModeError] = useState(null);

  const [setupKey, setSetupKey] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupShow, setSetupShow] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState(null);

  const [currentKey, setCurrentKey] = useState('');
  const [newKey, setNewKey] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [keyShow, setKeyShow] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState(null);
  const [keyError, setKeyError] = useState(null);

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (notepadMode && !unlocked) {
    return <Redirect href="/" />;
  }

  const save = async () => {
    const trimmed = displayName.trim();

    if (trimmed.length < 1) {
      setError('Display name cannot be empty.');
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateProfile({ displayName: trimmed });
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotepadMode = async () => {
    if (!user.notepadModeEnabled && !user.hasSecretKey) {
      setModeError('Set a secret key below before enabling Notepad Mode.');
      setModeMessage(null);
      return;
    }

    setUpdatingMode(true);
    setModeError(null);
    setModeMessage(null);

    try {
      const updated = await api.setNotepadMode(!user.notepadModeEnabled);

      await applyUser(updated);

      if (updated.notepadModeEnabled) {
        markUnlocked();
      }

      setModeMessage(updated.notepadModeEnabled ? 'Notepad Mode enabled.' : 'Notepad Mode disabled.');
    } catch (err) {
      setModeError(err.message);
    } finally {
      setUpdatingMode(false);
    }
  };

  const setupSecretKey = async () => {
    const keyError = validateSecretKey(setupKey);

    if (keyError) {
      setSetupError(keyError);
      return;
    }

    if (setupKey !== setupConfirm) {
      setSetupError('Secret key and confirmation do not match.');
      return;
    }

    setSetupSaving(true);
    setSetupError(null);
    setModeError(null);

    try {
      let updated = await api.createSecretKey({ secretKey: setupKey });

      updated = await api.setNotepadMode(true);

      await applyUser(updated);
      markUnlocked();

      setSetupKey('');
      setSetupConfirm('');
      setSetupShow(false);
      setModeMessage('Secret key saved and Notepad Mode enabled.');
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setSetupSaving(false);
    }
  };

  const changeSecretKey = async () => {
    const keyError = validateSecretKey(newKey);

    if (keyError) {
      setKeyError(keyError);
      return;
    }

    if (newKey !== confirmNew) {
      setKeyError('New secret key and confirmation do not match.');
      return;
    }

    if (!currentKey) {
      setKeyError('Enter your current secret key.');
      return;
    }

    setSaving(true);
    setKeyError(null);
    setKeyMessage(null);

    try {
      const updated = await api.changeSecretKey({
        currentSecretKey: currentKey,
        newSecretKey: newKey,
      });

      await applyUser(updated);

      setCurrentKey('');
      setNewKey('');
      setConfirmNew('');
      setKeyMessage('Secret key updated.');
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
          </View>

          <Text style={styles.username}>@{user.username}</Text>

          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={32}
            editable={!saving}
            placeholder="Display name"
            placeholderTextColor="#9ca3af"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <TouchableOpacity
            style={[styles.button, saving && styles.disabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Notepad Mode</Text>
          <Text style={styles.sectionSub}>
            When enabled, opening NotApp shows the notepad first. The chat stays hidden until you
            enter your secret key.
          </Text>
          <Text style={styles.statusLine}>
            Status: <Text style={styles.statusValue}>{user.notepadModeEnabled ? 'On' : 'Off'}</Text>
          </Text>

          {modeError ? <Text style={styles.error}>{modeError}</Text> : null}
          {modeMessage ? <Text style={styles.success}>{modeMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.button, updatingMode && styles.disabled]}
            onPress={toggleNotepadMode}
            disabled={updatingMode}
          >
            <Text style={styles.buttonText}>
              {updatingMode
                ? 'Saving…'
                : user.notepadModeEnabled
                  ? 'Disable Notepad Mode'
                  : 'Enable Notepad Mode'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Secret key</Text>

          {user.hasSecretKey ? (
            <>
              <Text style={styles.sectionSub}>
                Change your secret key. You must provide the current key first.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Current secret key"
                placeholderTextColor="#9ca3af"
                value={currentKey}
                onChangeText={setCurrentKey}
                secureTextEntry={!keyShow}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
              />

              <KeyInput
                placeholder="New secret key"
                value={newKey}
                onChangeText={setNewKey}
                show={keyShow}
                onToggle={() => setKeyShow((prev) => !prev)}
                editable={!saving}
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm new secret key"
                placeholderTextColor="#9ca3af"
                value={confirmNew}
                onChangeText={setConfirmNew}
                secureTextEntry={!keyShow}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
              />

              {keyError ? <Text style={styles.error}>{keyError}</Text> : null}
              {keyMessage ? <Text style={styles.success}>{keyMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.button, saving && styles.disabled]}
                onPress={changeSecretKey}
                disabled={saving}
              >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Update secret key'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionSub}>
                Set a secret key to enable Notepad Mode. This key opens the chat from the notepad.
              </Text>

              <KeyInput
                placeholder="Secret key"
                value={setupKey}
                onChangeText={setSetupKey}
                show={setupShow}
                onToggle={() => setSetupShow((prev) => !prev)}
                editable={!setupSaving}
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm secret key"
                placeholderTextColor="#9ca3af"
                value={setupConfirm}
                onChangeText={setSetupConfirm}
                secureTextEntry={!setupShow}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!setupSaving}
              />

              {setupError ? <Text style={styles.error}>{setupError}</Text> : null}

              <TouchableOpacity
                style={[styles.button, setupSaving && styles.disabled]}
                onPress={setupSecretKey}
                disabled={setupSaving}
              >
                <Text style={styles.buttonText}>
                  {setupSaving ? 'Saving…' : 'Save secret key & enable'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.signOut} onPress={logout}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function KeyInput({ placeholder, value, onChangeText, show, onToggle, editable }) {
  return (
    <View style={styles.keyRow}>
      <TextInput
        style={styles.keyInput}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
      />
      <TouchableOpacity style={styles.showBtn} onPress={onToggle}>
        <Text style={styles.showText}>{show ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 20,
    gap: 12,
    alignItems: 'stretch',
  },
  avatar: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 28,
  },
  username: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#6b7280',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  showBtn: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  showText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSub: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  statusLine: {
    fontSize: 14,
    color: '#374151',
  },
  statusValue: {
    fontWeight: '700',
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  signOut: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  success: {
    color: '#16a34a',
    fontWeight: '600',
  },
});
