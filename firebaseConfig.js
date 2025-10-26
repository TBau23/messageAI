import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);

export const functions = getFunctions(app);

// Connect to emulators in development mode
if (__DEV__) {
  // Use environment variable for emulator host, fallback to localhost
  // For physical devices, set EXPO_PUBLIC_EMULATOR_HOST to your computer's local IP
  // e.g., EXPO_PUBLIC_EMULATOR_HOST=192.168.1.100
  const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';
  
  // Only connect once to avoid "already connected" errors
  let emulatorsConnected = false;
  
  if (!emulatorsConnected) {
    try {
      connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
      connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
      connectStorageEmulator(storage, EMULATOR_HOST, 9199);

      emulatorsConnected = true;
    } catch (error) {
      console.warn('⚠️ Emulator connection warning (might already be connected):', error.message);
    }
  }
}