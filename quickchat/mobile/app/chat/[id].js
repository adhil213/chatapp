import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import MessageBubble from '../../components/MessageBubble';
import MessageComposer from '../../components/MessageComposer';
import OnlineDot from '../../components/OnlineDot';
import { useChat } from '../../hooks/useChat';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useNotepad } from '../../hooks/useNotepad';
import { useIdentity } from '../../hooks/useIdentity';
import { getUser } from '../../services/api';
import { presenceLabel } from '../../utils/presence';

const CONNECTION_LABEL = {
  connected: null,
  connecting: 'Connecting…',
  disconnected: 'Offline — messages will retry when you reconnect',
};

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams();
  const recipientId = String(id);
  const friend = name || recipientId;

  const { user } = useIdentity();
  const { notepadMode, unlocked } = useNotepad();
  const { status, presence, seedPresence } = useChatSocket();
  const { messages, loading, loadingMore, hasMore, error, sendText, retry, loadOlder } =
    useChat(recipientId);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;

    getUser(recipientId)
      .then((user) => {
        if (active) seedPresence([user]);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [recipientId, seedPresence]);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const selfId = user ? user._id : null;
  const banner = CONNECTION_LABEL[status];

  const friendEntry = presence[recipientId] || null;
  const friendOnline = Boolean(friendEntry && friendEntry.online);
  const friendStatus = friendOnline ? 'Online' : presenceLabel(friendEntry);

  const retryAll = async () => {
    setRetrying(true);

    const failed = messages.filter((m) => m.status === 'failed');

    for (const message of failed) {
      await retry(message.clientMessageId);
    }

    setRetrying(false);
  };

  if (notepadMode && !unlocked) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: String(friend) }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.presenceRow}>
          <OnlineDot online={friendOnline} />
          <Text style={[styles.presenceText, friendOnline && styles.presenceOnline]}>
            {friendStatus || 'Offline'}
          </Text>
        </View>

        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={data}
            inverted
            keyExtractor={(item) => item._id || item.clientMessageId}
            contentContainerStyle={styles.list}
            onEndReached={hasMore ? loadOlder : undefined}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footer}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.senderId === selfId} onRetry={retry} />
            )}
            ListEmptyComponent={
              error ? (
                <View style={styles.empty}>
                  <Text style={styles.error}>{String(error.message || error)}</Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.muted}>No messages yet. Say hello.</Text>
                </View>
              )
            }
          />
        )}

        {messages.some((m) => m.status === 'failed') ? (
          <TouchableOpacity style={styles.retryBar} onPress={retryAll} disabled={retrying}>
            <Text style={styles.retryText}>
              {retrying ? 'Retrying…' : 'Retry unsent messages'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <MessageComposer onSend={sendText} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  presenceText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  presenceOnline: {
    color: '#16a34a',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  footer: {
    paddingVertical: 14,
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
  },
  banner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerText: {
    color: '#92400e',
    fontSize: 12,
    textAlign: 'center',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
  },
  muted: {
    color: '#6b7280',
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBar: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    alignItems: 'center',
  },
  retryText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13,
  },
});
