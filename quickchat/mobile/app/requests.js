import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';

import { useChatSocket } from '../hooks/useChatSocket';
import { useNotepad } from '../hooks/useNotepad';
import { acceptRequest, listRequests, rejectRequest } from '../services/api';

export default function RequestsScreen() {
  const router = useRouter();
  const { notepadMode, unlocked } = useNotepad();
  const { subscribe } = useChatSocket();
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const result = await listRequests();

      setIncoming(result.incoming || []);
      setOutgoing(result.outgoing || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return subscribe((event) => {
      if (
        event.type === 'request:new' ||
        event.type === 'request:updated' ||
        event.type === 'conversation:new' ||
        event.type === 'ready'
      ) {
        load();
      }
    });
  }, [subscribe, load]);

  const accept = useCallback(
    async (request) => {
      setBusyId(request._id);

      try {
        await acceptRequest(request._id);

        router.push({
          pathname: '/chat/[id]',
          params: { id: request.user._id, name: request.user.displayName },
        });

        load(true);
      } catch (err) {
        setError(err);
      } finally {
        setBusyId(null);
      }
    },
    [router, load]
  );

  const reject = useCallback(
    async (request) => {
      setBusyId(request._id);

      try {
        await rejectRequest(request._id);
        setIncoming((prev) => prev.filter((item) => item._id !== request._id));
      } catch (err) {
        setError(err);
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const rows = [
    ...incoming.map((item) => ({ ...item, kind: 'incoming' })),
    ...outgoing.map((item) => ({ ...item, kind: 'outgoing' })),
  ];

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Chat requests</Text>
      {error ? <Text style={styles.error}>{String(error.message || error)}</Text> : null}
      <Text style={styles.sectionLabel}>Incoming</Text>
    </View>
  );

  if (notepadMode && !unlocked) {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}:${item._id}`}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>No requests yet. Find people from Search.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.user.displayName}</Text>
              <Text style={styles.subtitle}>
                @{item.user.username} · {item.kind === 'incoming' ? 'wants to chat' : 'request sent'}
              </Text>
            </View>

            {item.kind === 'incoming' ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.acceptBtn, busyId === item._id && styles.disabled]}
                  onPress={() => accept(item)}
                  disabled={busyId === item._id}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, busyId === item._id && styles.disabled]}
                  onPress={() => reject(item)}
                  disabled={busyId === item._id}
                >
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    gap: 8,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#6b7280',
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rejectText: {
    color: '#6b7280',
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingText: {
    color: '#92400e',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
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
  },
});
