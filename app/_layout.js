import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { startNetworkMonitoring, stopNetworkMonitoring } from '../utils/networkMonitor';

export default function RootLayout() {
  useEffect(() => {
    // Start network monitoring when app loads
    startNetworkMonitoring();
    
    return () => {
      // Clean up when app unmounts
      stopNetworkMonitoring();
    };
  }, []);

  return <Slot />;
}

