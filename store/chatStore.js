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
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      set({ messages: msgs });
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
      // Add optimistic message
      const tempId = `temp_${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        text,
        senderId,
        timestamp: new Date(),
        status: 'sending',
        localId: tempId
      };

      set((state) => ({
        messages: [...state.messages, optimisticMessage]
      }));

      // Send to Firestore
      const messageRef = await addDoc(
        collection(db, `conversations/${conversationId}/messages`),
        {
          text,
          senderId,
          timestamp: serverTimestamp(),
          deliveredTo: [senderId],
          readBy: [senderId],
          status: 'sent'
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

      // Remove optimistic message (real one will come from listener)
      set((state) => ({
        messages: state.messages.filter(msg => msg.id !== tempId)
      }));

      return { success: true, messageId: messageRef.id };
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update optimistic message to show error
      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === `temp_${Date.now()}` 
            ? { ...msg, status: 'error' }
            : msg
        )
      }));

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
    set({ messages: [], currentConversation: null });
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

