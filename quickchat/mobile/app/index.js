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
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useIdentity } from '../hooks/useIdentity';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function AuthScreen() {
  const { user, loading, signIn, signUp } = useIdentity();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/chats" />;
  }

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

    if (isRegister && displayName.trim().length < 1) {
      setError('Please enter a display name.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isRegister) {
        await signUp({
          username: cleanUsername,
          displayName: displayName.trim(),
          password,
        });
      } else {
        await signIn({ username: cleanUsername, password });
      }
    } catch (err) {
      setError(err.message);
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
          <Text style={styles.heading}>QuickChat</Text>
          <Text style={styles.sub}>
            {isRegister ? 'Create an account to get started.' : 'Sign in to continue.'}
          </Text>

          <View style={styles.tabs}>
            {['login', 'register'].map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.tab, mode === item && styles.tabActive]}
                onPress={() => {
                  setMode(item);
                  setError(null);
                }}
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
            returnKeyType="done"
            onSubmitEditing={submit}
          />

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
