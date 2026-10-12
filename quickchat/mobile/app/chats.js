import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import OnlineDot from '../components/OnlineDot';
import { useChatSocket } from '../hooks/useChatSocket';
import { useIdentity } from '../hooks/useIdentity';
import { listConversations } from '../services/api';
import { presenceLabel } from '../utils/presence';

function preview(conversation) {
  const message = conversation.lastMessage;

  if (!message) return 'No messages yet';

  return message.text;
}

export default function ChatsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useIdentity();
  const { presence, seedPresence, subscribe } = useChatSocket();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await listConversations();

        if (!mountedRef.current) return;

        setConversations(result);
        seedPresence(result.map((item) => item.user).filter(Boolean));
      } catch (err) {
        if (mountedRef.current) setError(err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [seedPresence]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load])
  );

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'message' || event.type === 'conversation:new' || event.type === 'ready') {
        load();
      }
    });
  }, [subscribe, load]);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  const openChat = (conversation) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: conversation.user._id, name: conversation.user.displayName },
    });
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.hi}>{user.displayName}</Text>
          <Text style={styles.handle}>@{user.username}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/search')}>
            <Text style={styles.actionText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/requests')}>
            <Text style={styles.actionText}>Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/profile')}>
            <Text style={styles.actionText}>Profile</Text>
          </TouchableOpacity>
        </View>
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
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        extraData={presence}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            {error ? (
              <Text style={styles.error}>{String(error.message || error)}</Text>
            ) : (
              <Text style={styles.muted}>
                No chats yet. Tap Search to find someone and send a request.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const entry = presence[item.user._id] || {
            online: item.user.online,
            lastSeen: item.user.lastSeen,
          };
          const label = entry.online ? 'Online' : presenceLabel(entry);

          return (
            <TouchableOpacity style={styles.row} onPress={() => openChat(item)}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.user.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.dotOverlay}>
                  <OnlineDot online={entry.online} bordered />
                </View>
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.user.displayName}
                </Text>
                <Text style={[styles.subtitle, entry.online && styles.subtitleOnline]} numberOfLines={1}>
                  {entry.online ? label : preview(item)}
                </Text>
              </View>
              {item.unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              ) : null}
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
    marginBottom: 8,
  },
  headerRow: {
    gap: 10,
  },
  hi: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  handle: {
    color: '#6b7280',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionText: {
    color: '#3730a3',
    fontWeight: '700',
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
    fontSize: 13,
    color: '#9ca3af',
  },
  subtitleOnline: {
    color: '#16a34a',
    fontWeight: '600',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  muted: {
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
    textAlign: 'center',
  },
});
