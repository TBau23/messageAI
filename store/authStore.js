import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { registerForPushNotifications } from '../utils/notifications';
import { getFriendlyAuthError } from '../utils/authErrors';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,
  pushToken: null,

  initializeAuth: async () => {
    try {
      // Listen to auth state changes
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userDoc.data(),
            };
            set({ user: userData, loading: false });
            
            // Update online status
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              online: true,
              lastSeen: serverTimestamp(),
            });
          } else {
            set({ user: null, loading: false });
          }
        } else {
          set({ user: null, loading: false });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ loading: false, error: error.message });
    }
  },

  signIn: async (email, password) => {
    try {
      set({ loading: true, error: null });
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Update online status
      await updateDoc(doc(db, 'users', userCredential.user.uid), {
        online: true,
        lastSeen: serverTimestamp(),
      });
      
      set({ loading: false });
      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      const friendlyError = getFriendlyAuthError(error.message);
      set({ loading: false, error: friendlyError });
      return { success: false, error: friendlyError };
    }
  },

  signUp: async (email, password) => {
    try {
      set({ loading: true, error: null });
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email,
        createdAt: serverTimestamp(),
        online: true,
        lastSeen: serverTimestamp(),
      });
      
      set({ loading: false });
      return { success: true, uid: userCredential.user.uid };
    } catch (error) {
      console.error('Sign up error:', error);
      const friendlyError = getFriendlyAuthError(error.message);
      set({ loading: false, error: friendlyError });
      return { success: false, error: friendlyError };
    }
  },

  updateProfile: async (displayName) => {
    try {
      const { user } = get();
      if (!user) return { success: false, error: 'No user logged in' };

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName,
      });

      set({ 
        user: { ...user, displayName } 
      });

      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  },

  setUserOnlineStatus: async (isOnline) => {
    try {
      const { user } = get();
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid), {
        online: isOnline,
        lastSeen: serverTimestamp(),
      });

      set({ 
        user: { ...user, online: isOnline } 
      });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  },

  registerPushToken: async () => {
    try {
      const { user, pushToken: existingToken } = get();
      if (!user) {
        console.log('No user logged in, skipping push token registration');
        return null;
      }

      // Get push token
      const token = await registerForPushNotifications();
      if (!token) {
        console.log('Failed to get push token (permission denied or simulator)');
        return null;
      }

      // Only update if token changed
      if (token === existingToken) {
        console.log('Push token unchanged, skipping update');
        return token;
      }

      // Save token to Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        pushToken: token,
        pushTokenUpdatedAt: serverTimestamp(),
      });

      // Update local state
      set({ 
        pushToken: token,
        user: { ...user, pushToken: token }
      });

      console.log('✅ Push token registered and saved to Firestore');
      return token;
    } catch (error) {
      console.error('Error registering push token:', error);
      return null;
    }
  },

  clearPushToken: async () => {
    try {
      const { user } = get();
      if (!user) return;

      // Clear token from Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        pushToken: null,
      });

      // Clear local state
      set({ pushToken: null });
      console.log('✅ Push token cleared');
    } catch (error) {
      console.error('Error clearing push token:', error);
    }
  },

  signOut: async () => {
    try {
      const { user, clearPushToken } = get();
      if (user) {
        // Clear push token first
        await clearPushToken();
        
        // Set user offline before signing out
        await updateDoc(doc(db, 'users', user.uid), {
          online: false,
          lastSeen: serverTimestamp(),
        });
      }
      await firebaseSignOut(auth);
      set({ user: null, error: null, pushToken: null });
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  },
}));

