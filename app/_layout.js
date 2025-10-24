import { Slot } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, View } from 'react-native';
import { startNetworkMonitoring, stopNetworkMonitoring } from '../utils/networkMonitor';
import { useAuthStore } from '../store/authStore';
import { database } from '../utils/database';

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const { user, setUserOnlineStatus } = useAuthStore();
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

