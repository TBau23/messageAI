import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

// Zustand store for network state
export const useNetworkStore = create((set, get) => ({
  isOnline: true,
  isConnecting: false,
  
  setOnline: (online) => set({ isOnline: online }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
}));

let unsubscribe = null;

export const startNetworkMonitoring = () => {
  console.log('Starting network monitoring...');
  
  unsubscribe = NetInfo.addEventListener(state => {
    const isOnline = state.isConnected && state.isInternetReachable;
    const wasOnline = useNetworkStore.getState().isOnline;
    
    console.log('Network status changed:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isOnline
    });
    
    useNetworkStore.getState().setOnline(isOnline);
    
    // Show "Connecting..." briefly when coming back online
    if (isOnline && !wasOnline) {
      useNetworkStore.getState().setConnecting(true);
      console.log('Connection restored, showing connecting banner...');
      
      setTimeout(() => {
        useNetworkStore.getState().setConnecting(false);
        console.log('Connected successfully');
      }, 1500);
    }
  });
  
  // Get initial state
  NetInfo.fetch().then(state => {
    const isOnline = state.isConnected && state.isInternetReachable;
    useNetworkStore.getState().setOnline(isOnline);
    console.log('Initial network state:', isOnline ? 'Online' : 'Offline');
  });
};

export const stopNetworkMonitoring = () => {
  console.log('Stopping network monitoring...');
  unsubscribe?.();
  unsubscribe = null;
};

export const getNetworkState = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable;
};

