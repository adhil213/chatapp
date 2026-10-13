import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatMessageTime } from '../utils/datetime';

function Ticks({ status }) {
  if (status === 'read') {
    return <Text style={[styles.tick, styles.tickRead]}>✓✓</Text>;
  }

  if (status === 'delivered') {
    return <Text style={[styles.tick, styles.tickGrey]}>✓✓</Text>;
  }

  if (status === 'sent') {
    return <Text style={[styles.tick, styles.tickGrey]}>✓</Text>;
  }

  return null;
}

function MessageBubble({ message, isMine, onRetry }) {
  const failed = message.status === 'failed';
  const sending = !failed && (message.pending || message.status === 'sending');

  const metaLabel = failed
    ? 'Not sent — tap to retry'
    : sending
      ? 'Sending…'
      : formatMessageTime(message.createdAt);

  const content = (
    <View style={[styles.bubble, isMine ? styles.mine : styles.theirs, failed && styles.failed]}>
      <Text style={[styles.text, failed && styles.failedText]}>{message.text}</Text>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, failed && styles.failedMeta]}>{metaLabel}</Text>
        {isMine && !failed ? <Ticks status={message.status} /> : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {failed && onRetry ? (
        <TouchableOpacity onPress={() => onRetry(message.clientMessageId)}>{content}</TouchableOpacity>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  mine: {
    backgroundColor: '#dbeafe',
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  failed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  text: {
    fontSize: 16,
    color: '#111827',
  },
  failedText: {
    color: '#7f1d1d',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
  },
  meta: {
    fontSize: 11,
    color: '#6b7280',
  },
  failedMeta: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  tick: {
    fontSize: 13,
    fontWeight: '700',
  },
  tickGrey: {
    color: '#9ca3af',
  },
  tickRead: {
    color: '#2563eb',
  },
});

export default memo(MessageBubble);
