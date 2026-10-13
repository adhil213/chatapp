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
import { useRouter } from 'expo-router';

import AuthForm from '../components/AuthForm';
import { useIdentity } from '../hooks/useIdentity';
import * as api from '../services/api';

function validateSecretKey(value) {
  if (!value) return 'Secret key is required.';
  if (/\s/.test(value)) return 'Secret key cannot contain spaces.';
  if (value.length < 8 || value.length > 128) return 'Secret key must be 8-128 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Secret key must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Secret key must include at least one number.';
  return null;
}

export default function RecoveryScreen() {
  const router = useRouter();
  const { user, loading, applyUser } = useIdentity();

  const [secretKey, setSecretKey] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

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
            <Text style={styles.heading}>Account recovery</Text>
            <Text style={styles.sub}>
              Sign in to your account first. Then you can reset your notepad secret key.
            </Text>
            <AuthForm message="Your identity must be verified." />
            <TouchableOpacity style={styles.linkBtn} onPress={goToNotes}>
              <Text style={styles.linkText}>Back to notes</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const submit = async () => {
    const keyError = validateSecretKey(secretKey);

    if (keyError) {
      setError(keyError);
      return;
    }

    if (secretKey !== confirm) {
      setError('Secret key and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await api.resetSecretKey({ secretKey });

      await applyUser(updated);

      setSecretKey('');
      setConfirm('');
      setMessage('Your secret key was reset.');

      setTimeout(() => router.replace('/'), 700);
    } catch (err) {
      setError(err.message || 'Could not reset the secret key. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Reset secret key</Text>
        <Text style={styles.sub}>
          You are signed in, so you can set a new secret key below. Long-pressing the logo only
          opens this screen — it never resets your key by itself.
        </Text>

        <View style={styles.keyRow}>
          <TextInput
            style={styles.keyInput}
            placeholder="New secret key"
            placeholderTextColor="#9ca3af"
            value={secretKey}
            onChangeText={setSecretKey}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
          <TouchableOpacity style={styles.showBtn} onPress={() => setShow((p) => !p)}>
            <Text style={styles.showText}>{show ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Confirm new secret key"
          placeholderTextColor="#9ca3af"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.disabled]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? 'Please wait…' : 'Reset secret key'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={goToNotes}>
          <Text style={styles.linkText}>Back to notes</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scroll: {
    padding: 20,
    gap: 14,
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
    lineHeight: 20,
    marginBottom: 4,
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
  error: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  success: {
    color: '#16a34a',
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
