import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import OnlineDot from '../components/OnlineDot';
import { useChatSocket } from '../hooks/useChatSocket';
import { createRequest, searchUsers } from '../services/api';
import { presenceLabel } from '../utils/presence';

const DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const router = useRouter();
  const { presence, seedPresence } = useChatSocket();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sentIds, setSentIds] = useState({});

  const seqRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      seqRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const seq = seqRef.current + 1;
      seqRef.current = seq;

      try {
        const users = await searchUsers(trimmed);

        if (seqRef.current !== seq) return;

        setResults(users);
        seedPresence(users);
      } catch (err) {
        if (seqRef.current === seq) setError(err);
      } finally {
        if (seqRef.current === seq) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, seedPresence]);

  const sendRequest = useCallback(async (user) => {
    setBusyId(user._id);

    try {
      await createRequest({ userId: user._id });

      setSentIds((prev) => ({ ...prev, [user._id]: true }));
      setResults((prev) =>
        prev.map((item) => (item._id === user._id ? { ...item, relationship: 'pending_out' } : item))
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }, []);

  const openChat = (user) => {
    router.push({ pathname: '/chat/[id]', params: { id: user._id, name: user.displayName } });
  };

  const renderAction = (user) => {
    const relationship = sentIds[user._id] ? 'pending_out' : user.relationship;

    if (relationship === 'accepted') {
      return (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => openChat(user)}>
          <Text style={styles.primaryText}>Message</Text>
        </TouchableOpacity>
      );
    }

    if (relationship === 'pending_out') {
      return (
        <View style={styles.pendingBtn}>
          <Text style={styles.pendingText}>Requested</Text>
        </View>
      );
    }

    if (relationship === 'pending_in') {
      return (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/requests')}>
          <Text style={styles.primaryText}>Respond</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.primaryBtn, busyId === user._id && styles.btnDisabled]}
        onPress={() => sendRequest(user)}
        disabled={busyId === user._id}
      >
        <Text style={styles.primaryText}>{busyId === user._id ? '…' : 'Add'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search by username"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          extraData={presence}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              {error ? (
                <Text style={styles.error}>{String(error.message || error)}</Text>
              ) : query.trim().length >= 2 ? (
                <Text style={styles.muted}>No users matched.</Text>
              ) : (
                <Text style={styles.muted}>Type at least 2 characters to search.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const entry = presence[item._id] || { online: item.online, lastSeen: item.lastSeen };

            return (
              <View style={styles.row}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.dotOverlay}>
                    <OnlineDot online={entry.online} bordered />
                  </View>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    @{item.username}
                    {entry.online ? ' · Online' : ''} {entry.online ? '' : presenceLabel(entry)}
                  </Text>
                </View>
                {renderAction(item)}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  searchBar: {
    padding: 16,
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  dotOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pendingBtn: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pendingText: {
    color: '#6b7280',
    fontWeight: '700',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  muted: {
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
    textAlign: 'center',
  },
});
