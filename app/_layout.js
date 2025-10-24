import { Slot } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { startNetworkMonitoring, stopNetworkMonitoring } from '../utils/networkMonitor';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const { user, setUserOnlineStatus } = useAuthStore();

  useEffect(() => {
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
  }, [user]);

  return <Slot />;
}

