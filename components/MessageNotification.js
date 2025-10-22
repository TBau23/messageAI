import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

export default function MessageNotification({ message, onPress, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Slide in
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      dismissNotification();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const dismissNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={() => {
          dismissNotification();
          onPress();
        }}
        activeOpacity={0.9}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {message.senderName?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.senderName} numberOfLines={1}>
            {message.senderName || 'Unknown'}
          </Text>
          <Text style={styles.messageText} numberOfLines={2}>
            {message.text}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={(e) => {
            e.stopPropagation();
            dismissNotification();
          }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    padding: 12,
    marginHorizontal: 10,
    marginTop: 50,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  senderName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  messageText: {
    color: '#e8f5e9',
    fontSize: 13,
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

