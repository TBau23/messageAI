import { Slot, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { startNetworkMonitoring, stopNetworkMonitoring } from '../utils/networkMonitor';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { database } from '../utils/database';

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const { user, setUserOnlineStatus, registerPushToken } = useAuthStore();
  const { updateBadgeCount } = useChatStore();
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    // Initialize database first (critical!)
    const initDatabase = async () => {
      try {
        await database.init();
        console.log('✅ SQLite database initialized');
        setDbInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        // Still allow app to load even if database fails
        setDbInitialized(true);
      }
    };

    initDatabase();
  }, []);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (user && dbInitialized) {
      registerPushToken();
    }
  }, [user, dbInitialized]);

  // Handle notification taps (deep linking)
  useEffect(() => {
    if (!dbInitialized) return;

    // Handle notification tap when app is foregrounded or opened from closed state
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const conversationId = response.notification.request.content.data?.conversationId;
        
        if (conversationId) {
          console.log('📱 Notification tapped, navigating to chat:', conversationId);
          // Use setTimeout to ensure navigation happens after any pending navigations
          setTimeout(() => {
            router.push(`/chat/${conversationId}`);
          }, 100);
        }
      }
    );

    return () => {
      notificationResponseSubscription.remove();
    };
  }, [dbInitialized]);

  useEffect(() => {
    if (!dbInitialized) return; // Wait for database
    
    // Start network monitoring when app loads
    startNetworkMonitoring();
    
    // Listen to app state changes (active, background, inactive)
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('AppState changed:', appState.current, '->', nextAppState);
      
      if (user) {
        // App going to background or inactive
        if (
          appState.current.match(/active/) &&
          nextAppState.match(/inactive|background/)
        ) {
          console.log('App backgrounded - setting user offline');
          setUserOnlineStatus(false);
        }
        
        // App coming to foreground
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          console.log('App foregrounded - setting user online');
          setUserOnlineStatus(true);
          
          // Update badge count when app comes to foreground
          updateBadgeCount(user.uid);
        }
      }
      
      appState.current = nextAppState;
    });
    
    return () => {
      // Clean up
      stopNetworkMonitoring();
      subscription.remove();
    };
  }, [user, dbInitialized]);

  // Show loading while database initializes
  if (!dbInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return <Slot />;
}

