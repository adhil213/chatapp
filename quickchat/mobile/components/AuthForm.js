import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useIdentity } from '../hooks/useIdentity';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function validateSecretKey(value) {
  if (!value) return 'Secret key is required.';
  if (/\s/.test(value)) return 'Secret key cannot contain spaces.';
  if (value.length < 8 || value.length > 128) return 'Secret key must be 8-128 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Secret key must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Secret key must include at least one number.';
  return null;
}

export default function AuthForm({ onSuccess, message }) {
  const { signIn, signUp } = useIdentity();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isRegister = mode === 'register';

  const submit = async () => {
    const cleanUsername = username.trim().toLowerCase();

    if (!USERNAME_PATTERN.test(cleanUsername)) {
      setError('Username must be 3-20 characters: a-z, 0-9 or _.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (isRegister) {
      if (displayName.trim().length < 1) {
        setError('Please enter a display name.');
        return;
      }

      const keyError = validateSecretKey(secretKey);

      if (keyError) {
        setError(keyError);
        return;
      }

      if (secretKey !== confirmKey) {
        setError('Secret key and confirmation do not match.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isRegister) {
        const user = await signUp({
          username: cleanUsername,
          displayName: displayName.trim(),
          password,
          secretKey,
        });

        setSecretKey('');
        setConfirmKey('');
        setPassword('');

        if (onSuccess) onSuccess(user);
      } else {
        const user = await signIn({ username: cleanUsername, password });

        setPassword('');

        if (onSuccess) onSuccess(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setSecretKey('');
    setConfirmKey('');
  };

  return (
    <View style={styles.container}>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Text style={styles.heading}>NotApp</Text>
      <Text style={styles.sub}>
        {isRegister ? 'Create an account to get started.' : 'Sign in to continue.'}
      </Text>

      <View style={styles.tabs}>
        {['login', 'register'].map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.tab, mode === item && styles.tabActive]}
            onPress={() => switchMode(item)}
            disabled={submitting}
          >
            <Text style={[styles.tabText, mode === item && styles.tabTextActive]}>
              {item === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#9ca3af"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={!submitting}
      />

      {isRegister ? (
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor="#9ca3af"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          maxLength={32}
          editable={!submitting}
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        editable={!submitting}
      />

      {isRegister ? (
        <>
          <View style={styles.keyRow}>
            <TextInput
              style={styles.keyInput}
              placeholder="Secret key"
              placeholderTextColor="#9ca3af"
              value={secretKey}
              onChangeText={setSecretKey}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
            <TouchableOpacity
              style={styles.showBtn}
              onPress={() => setShowKey((prev) => !prev)}
              disabled={submitting}
            >
              <Text style={styles.showText}>{showKey ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Confirm secret key"
            placeholderTextColor="#9ca3af"
            value={confirmKey}
            onChangeText={setConfirmKey}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />

          <Text style={styles.hint}>
            8-128 characters, with at least one letter and one number. You will use this key to
            open the chat from the notepad.
          </Text>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={submit}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  message: {
    color: '#2563eb',
    fontWeight: '600',
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  sub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#111827',
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
  hint: {
    fontSize: 12,
    color: '#6b7280',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
