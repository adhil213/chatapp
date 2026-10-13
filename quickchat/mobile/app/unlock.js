import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';

import AuthForm from '../components/AuthForm';
import { useCrypto } from '../hooks/useCrypto';
import { useIdentity } from '../hooks/useIdentity';
import { useNotepad } from '../hooks/useNotepad';
import { migrateAnonymousNotes } from '../hooks/useNotes';
import * as api from '../services/api';

function validateSecretKey(value) {
  if (!value) return 'Secret key is required.';
  if (/\s/.test(value)) return 'Secret key cannot contain spaces.';
  if (value.length < 8 || value.length > 128) return 'Secret key must be 8-128 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Secret key must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Secret key must include at least one number.';
  return null;
}

export default function UnlockScreen() {
  const router = useRouter();
  const { user, loading, applyUser } = useIdentity();
  const { notepadMode, markUnlocked } = useNotepad();
  const { unlock, provision } = useCrypto();

  const [key, setKey] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const goToNotes = () => router.replace('/');

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.container}>
            <AuthForm
              message="Sign in to open your chats."
              onSuccess={(nextUser) => {
                if (nextUser && nextUser._id) {
                  migrateAnonymousNotes(nextUser._id);
                }
              }}
            />
            <TouchableOpacity style={styles.linkBtn} onPress={goToNotes}>
              <Text style={styles.linkText}>Back to notes</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!notepadMode) {
    return <Redirect href="/chats" />;
  }

  const needsSetup = !user.hasSecretKey;

  const submit = async () => {
    if (needsSetup) {
      const keyError = validateSecretKey(key);

      if (keyError) {
        setError(keyError);
        return;
      }

      if (key !== confirm) {
        setError('Secret key and confirmation do not match.');
        return;
      }
    } else if (!key) {
      setError('Enter your secret key.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (needsSetup) {
        const identity = provision(key);
        const updated = await api.createSecretKey({ secretKey: key, ...identity });

        await applyUser(updated);
      } else {
        const body = await api.verifySecretKey({ secretKey: key });
        const identity = body && body.identity;

        if (identity && identity.kdfSalt && identity.keyBackup) {
          unlock({ secretKey: key, kdfSalt: identity.kdfSalt, keyBackup: identity.keyBackup });
        } else {
          const bundle = provision(key);
          const updated = await api.saveIdentity(bundle);

          await applyUser(updated);
        }
      }

      setKey('');
      setConfirm('');

      markUnlocked();
      router.replace('/chats');
    } catch (err) {
      setError(
        needsSetup
          ? err.message || 'Could not save the secret key. Please try again.'
          : 'Incorrect secret key. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.heading}>{needsSetup ? 'Create a secret key' : 'Enter secret key'}</Text>
          <Text style={styles.sub}>
            {needsSetup
              ? 'Set a secret key to protect your chats. You will use it to open them from the notepad.'
              : 'Enter your secret key to open the chats.'}
          </Text>

          <View style={styles.keyRow}>
            <TextInput
              style={styles.keyInput}
              placeholder="Secret key"
              placeholderTextColor="#9ca3af"
              value={key}
              onChangeText={setKey}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              autoFocus
            />
            <TouchableOpacity style={styles.showBtn} onPress={() => setShow((p) => !p)}>
              <Text style={styles.showText}>{show ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {needsSetup ? (
            <TextInput
              style={styles.input}
              placeholder="Confirm secret key"
              placeholderTextColor="#9ca3af"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, submitting && styles.disabled]}
            onPress={submit}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Please wait…' : needsSetup ? 'Save key and open' : 'Unlock'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={goToNotes}>
            <Text style={styles.linkText}>Back to notes</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: '#f5f6f8',
  },
  container: {
    padding: 20,
    gap: 14,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  sub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
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
  error: {
    color: '#b91c1c',
    fontWeight: '600',
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
  linkBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#6b7280',
    fontWeight: '600',
  },
});
