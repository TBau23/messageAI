import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import MessageNotification from '../../components/MessageNotification';
import { useNotificationStore } from '../../store/notificationStore';

export default function MainLayout() {
  const router = useRouter();
  const { notification, clearNotification } = useNotificationStore();

  const handleNotificationPress = () => {
    if (notification?.conversationId) {
      router.push(`/chat/${notification.conversationId}`);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="new-chat" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="chat/[id]" 
          options={{ headerShown: false }} 
        />
      </Stack>
      
      {/* Foreground notification banner */}
      {notification && (
        <MessageNotification
          message={notification}
          onPress={handleNotificationPress}
          onDismiss={clearNotification}
        />
      )}
    </View>
  );
}

