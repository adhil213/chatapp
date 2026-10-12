import { useCallback, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';

import OnlineDot from '../components/OnlineDot';
import { useChatSocket } from '../hooks/useChatSocket';
import { useIdentity } from '../hooks/useIdentity';
import { listUsers } from '../services/api';
import { presenceLabel } from '../utils/presence';

export default function UsersScreen() {
  const router = useRouter();
  const { identity, signOut } = useIdentity();
  const { presence, seedPresence } = useChatSocket();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!identity) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await listUsers({ exclude: identity.id });
        setUsers(result);
        seedPresence(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [identity, seedPresence]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openChat = (user) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: user._id, name: user.displayName },
    });
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.hi}>Signed in as {identity ? identity.displayName : '…'}</Text>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Pick someone to chat with</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.link}>Change name</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
        data={users}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        extraData={presence}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            {error ? (
              <Text style={styles.error}>{String(error.message || error)}</Text>
            ) : (
              <Text style={styles.muted}>No other users yet. Open a second app session and join.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const entry = presence[item._id] || { online: item.online, lastSeen: item.lastSeen };
          const label = entry.online ? 'Online' : presenceLabel(entry);

          return (
            <TouchableOpacity style={styles.row} onPress={() => openChat(item)}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.dotOverlay}>
                  <OnlineDot online={entry.online} bordered />
                </View>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={[styles.subtitle, entry.online && styles.subtitleOnline]}>{label}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
    backgroundColor: '#f5f6f8',
  },
  list: {
    padding: 16,
    gap: 8,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  hi: {
    color: '#6b7280',
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  link: {
    color: '#2563eb',
    fontWeight: '600',
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
  subtitleOnline: {
    color: '#16a34a',
    fontWeight: '600',
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
