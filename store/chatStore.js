import { create } from 'zustand';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  setDoc,
  getDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  optimisticMessages: [], // Local-only messages waiting for Firestore confirmation
  loading: false,
  error: null,

  // Subscribe to user's conversations
  subscribeToConversations: (userId) => {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          
          // Get other participant's info
          const otherParticipantId = data.participants.find(id => id !== userId);
          const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
          const otherUser = userDoc.data();

          return {
            id: docSnap.id,
            ...data,
            otherUser: {
              uid: otherParticipantId,
              ...otherUser
            }
          };
        })
      );

      set({ conversations: convos });
    });

    return unsubscribe;
  },

  // Subscribe to messages in a conversation
  subscribeToMessages: (conversationId) => {
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        _pendingSync: false, // Firestore messages are synced
      }));
      
      console.log('Firestore snapshot received:', firestoreMessages.length, 'messages');
      
      // Merge with optimistic messages
      const { optimisticMessages } = get();
      
      console.log('Current optimistic messages:', optimisticMessages.length);
      
      // Remove optimistic messages that now have Firestore IDs
      // Match by text + sender (more reliable than timestamp)
      const stillPending = optimisticMessages.filter(opt => {
        const matched = firestoreMessages.some(msg => {
          // Match if same text, same sender, and timestamp within 5 seconds
          const sameText = msg.text === opt.text;
          const sameSender = msg.senderId === opt.senderId;
          
          const optTime = opt.timestamp?.getTime?.() || opt.timestamp;
          const msgTime = msg.timestamp?.toMillis?.() || (msg.timestamp?.getTime?.() || msg.timestamp);
          const timeDiff = Math.abs(optTime - msgTime);
          const closeTime = timeDiff < 5000; // 5 second tolerance
          
          console.log('Matching attempt:', {
            optText: opt.text?.substring(0, 15),
            msgText: msg.text?.substring(0, 15),
            sameText,
            sameSender,
            timeDiff,
            closeTime,
            matched: sameText && sameSender && closeTime
          });
          
          return sameText && sameSender && closeTime;
        });
        
        return !matched; // Keep if not matched
      });
      
      console.log('Still pending after merge:', stillPending.length);
      
      // Combine: optimistic messages first (they're pending), then Firestore messages
      const allMessages = [...stillPending, ...firestoreMessages];
      
      console.log('Total messages after merge:', allMessages.length);
      
      set({ 
        messages: allMessages,
        optimisticMessages: stillPending
      });
    });

    return unsubscribe;
  },

  // Create or get existing conversation
  getOrCreateConversation: async (currentUserId, otherUserId) => {
    try {
      set({ loading: true, error: null });

      // Check if conversation already exists
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUserId)
      );

      const snapshot = await getDocs(q);
      const existingConvo = snapshot.docs.find(doc => {
        const participants = doc.data().participants;
        return participants.includes(otherUserId);
      });

      if (existingConvo) {
        set({ loading: false });
        return existingConvo.id;
      }

      // Create new conversation
      const newConvo = await addDoc(collection(db, 'conversations'), {
        participants: [currentUserId, otherUserId],
        type: 'direct',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null
      });

      set({ loading: false });
      return newConvo.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      set({ loading: false, error: error.message });
      return null;
    }
  },

  // Send a message
  sendMessage: async (conversationId, senderId, text) => {
    try {
      // Create optimistic message with pending flag
      const localId = `local_${Date.now()}_${Math.random()}`;
      const optimisticMessage = {
        localId,
        text,
        senderId,
        timestamp: new Date(),
        deliveredTo: [senderId],
        readBy: [senderId],
        _pendingSync: true, // Flag to indicate not yet synced to Firestore
      };

      console.log('Creating optimistic message:', {
        localId,
        text: text.substring(0, 20),
        pendingSync: true
      });

      // Add to both messages and optimisticMessages
      set((state) => ({
        messages: [...state.messages, optimisticMessage],
        optimisticMessages: [...state.optimisticMessages, optimisticMessage]
      }));

      console.log('Optimistic message added to state');

      // Send to Firestore (queued automatically if offline)
      const messageRef = await addDoc(
        collection(db, `conversations/${conversationId}/messages`),
        {
          text,
          senderId,
          timestamp: serverTimestamp(),
          deliveredTo: [senderId],
          readBy: [senderId],
        }
      );

      // Update conversation's last message
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
          text,
          senderId,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });

      // Firestore listener will handle removing from optimistic messages
      console.log('Message sent to Firestore:', messageRef.id);
      return { success: true, messageId: messageRef.id, localId };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  },

  // Mark messages as read
  markMessagesAsRead: async (conversationId, messageIds, userId) => {
    try {
      const promises = messageIds.map(messageId =>
        updateDoc(
          doc(db, `conversations/${conversationId}/messages/${messageId}`),
          {
            readBy: arrayUnion(userId)
          }
        )
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  // Clear messages when leaving chat
  clearMessages: () => {
    set({ messages: [], optimisticMessages: [], currentConversation: null });
  },

  // Search for users
  searchUsers: async (searchTerm, currentUserId) => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const users = snapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        }))
        .filter(user => 
          user.uid !== currentUserId && 
          user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
        );

      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }
}));

