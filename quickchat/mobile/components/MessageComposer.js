import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const QUICK_EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '😢', '😮', '❤️', '✅', '👋'];

export default function MessageComposer({ onSend, disabled }) {
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();

    if (!value) return;

    const sent = onSend(value);

    if (sent) {
      setText('');
    }
  };

  const addEmoji = (emoji) => {
    setText((prev) => `${prev}${emoji}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.emojiRow}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.emojiBtn}
            onPress={() => addEmoji(emoji)}
            disabled={disabled}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          style={[styles.button, (!text.trim() || disabled) && styles.buttonDisabled]}
          onPress={submit}
          disabled={disabled || !text.trim()}
        >
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingTop: 8,
  },
  emojiRow: {
    paddingHorizontal: 12,
    gap: 6,
  },
  emojiBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  emoji: {
    fontSize: 22,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
