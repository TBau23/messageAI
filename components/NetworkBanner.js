import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStore } from '../utils/networkMonitor';

export default function NetworkBanner() {
  const { isOnline, isConnecting } = useNetworkStore();

  // Don't show anything if we're online and not connecting
  if (isOnline && !isConnecting) return null;

  return (
    <View style={[
      styles.banner,
      isConnecting ? styles.connecting : styles.offline
    ]}>
      <Text style={styles.text}>
        {isConnecting ? '⏳ Connecting...' : '📵 No connection'}
      </Text>
      {!isOnline && (
        <Text style={styles.subtext}>Messages will send when online</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 10,
    alignItems: 'center',
  },
  offline: {
    backgroundColor: '#f44336',
  },
  connecting: {
    backgroundColor: '#ff9800',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subtext: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
});

