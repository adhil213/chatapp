import { StyleSheet, View } from 'react-native';

export default function OnlineDot({ online, size = 12, bordered = false }) {
  const dimension = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View
      style={[
        styles.dot,
        dimension,
        online ? styles.online : styles.offline,
        bordered && styles.bordered,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: '#9ca3af',
  },
  online: {
    backgroundColor: '#22c55e',
  },
  offline: {
    backgroundColor: '#9ca3af',
  },
  bordered: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
