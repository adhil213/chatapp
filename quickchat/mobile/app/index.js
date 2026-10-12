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
import { registerUser } from '../services/api';

export default function HomeScreen() {
  const { identity, loading, signIn } = useIdentity();
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (identity) {
    return <Redirect href="/users" />;
  }

  const submit = async (value) => {
    const name = (value ?? displayName).trim();

    if (name.length < 2) {
      setError('Please enter at least 2 characters.');
      setSuggestions([]);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuggestions([]);

    try {
      const user = await registerUser(name);
      await signIn(user);
    } catch (err) {
      setError(err.message);
      setSuggestions(err.suggestions || []);
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
          <Text style={styles.sub}>Pick a display name to get started.</Text>

          <TextInput
            style={styles.input}
            placeholder="Your display name"
            placeholderTextColor="#9ca3af"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={32}
            editable={!submitting}
            returnKeyType="done"
            onSubmitEditing={() => submit()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {suggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestLabel}>Try one of these:</Text>
              <View style={styles.chips}>
                {suggestions.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.chip}
                    onPress={() => {
                      setDisplayName(name);
                      submit(name);
                    }}
                    disabled={submitting}
                  >
                    <Text style={styles.chipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={() => submit()}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Continue'}</Text>
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
    marginBottom: 8,
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
  suggestBox: {
    gap: 8,
  },
  suggestLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#3730a3',
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
