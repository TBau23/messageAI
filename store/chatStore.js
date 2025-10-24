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
import { useNotificationStore } from './notificationStore';
import { database } from '../utils/database';

const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const getOrderTimestamp = (message = {}, metric = {}) => {
  if (typeof message.orderTimestamp === 'number') {
    return message.orderTimestamp;
  }

  const timestampCandidates = [
    message.timestamp,
    message.clientSentAt,
    message.sentAt,
    message.createdAt,
    metric?.sentAt
  ];

  for (const candidate of timestampCandidates) {
    const millis = toMillis(candidate);
    if (millis) {
      return millis;
    }
  }

  return Date.now();
};

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  error: null,
  previousConversations: {}, // Track previous state for notifications
  isInitialLoad: true, // Track if this is the first load
  pendingMessages: {}, // conversationId -> pending/failed optimistic messages
  messageMetrics: {}, // localId -> { conversationId, sentAt, deliveryLatencyMs?, failed? }

  // Subscribe to user's conversations
  subscribeToConversations: (userId) => {
    // Reset initial load flag when subscribing
    set({ isInitialLoad: true });
    
    // 1. Load from SQLite cache first (instant display)
    database.getConversations().then(async (cachedConversations) => {
      if (cachedConversations.length > 0) {
        console.log(`📦 Loaded ${cachedConversations.length} conversations from cache`);
        
        // Process cached conversations with participant details
        const processedConvos = await Promise.all(
          cachedConversations
            .filter(convo => convo.participants.includes(userId))
            .map(async (convo) => {
              if (convo.type === 'group') {
                const participantDetails = await Promise.all(
                  convo.participants
                    .filter(id => id !== userId)
                    .map(async (participantId) => {
                      const cached = await database.getUser(participantId);
                      if (cached) return cached;
                      
                      // Fallback to Firestore if not in cache
                      const userDoc = await getDoc(doc(db, 'users', participantId));
                      return {
                        uid: participantId,
                        ...userDoc.data()
                      };
                    })
                );

                return {
                  ...convo,
                  participantDetails,
                  _fromCache: true // Mark as cache-loaded
                };
              } else {
                const otherParticipantId = convo.participants.find(id => id !== userId);
                const cached = await database.getUser(otherParticipantId);
                
                if (cached) {
                  return {
                    ...convo,
                    otherUser: cached,
                    _fromCache: true // Mark as cache-loaded
                  };
                }
                
                // Fallback to Firestore if not in cache
                const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
                return {
                  ...convo,
                  otherUser: {
                    uid: otherParticipantId,
                    ...userDoc.data()
                  },
                  _fromCache: true // Mark as cache-loaded
                };
              }
            })
        );
        
        set({ conversations: processedConvos });
      }
    }).catch(err => {
      console.error('Error loading cached conversations:', err);
    });
    
    // 2. Subscribe to Firestore (for real-time updates)
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const { previousConversations, isInitialLoad } = get();
      
      const convos = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const convo = { id: docSnap.id, ...data };
          
          // Cache conversation to SQLite
          await database.upsertConversation(convo);
          
          if (data.type === 'group') {
            // For group chats, fetch all participant details
            const participantDetails = await Promise.all(
              data.participants
                .filter(id => id !== userId)
                .map(async (participantId) => {
                  const userDoc = await getDoc(doc(db, 'users', participantId));
                  const userData = {
                    uid: participantId,
                    ...userDoc.data()
                  };
                  
                  // Cache user to SQLite
                  await database.upsertUser(userData);
                  
                  return userData;
                })
            );

            return {
              id: docSnap.id,
              ...data,
              participants: data.participants,
              participantDetails
            };
          } else {
            // For direct chats, get other participant's info
            const otherParticipantId = data.participants.find(id => id !== userId);
            const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
            const otherUser = {
              uid: otherParticipantId,
              ...userDoc.data()
            };
            
            // Cache user to SQLite
            await database.upsertUser(otherUser);

            return {
              id: docSnap.id,
              ...data,
              otherUser
            };
          }
        })
      );

      // Check for new messages and trigger notifications (skip on initial load)
      if (!isInitialLoad) {
        convos.forEach((convo) => {
          const prevConvo = previousConversations[convo.id];
          const lastMsg = convo.lastMessage;
          
          // Trigger notification if:
          // 1. There's a last message
          // 2. The message is from someone else (not the current user)
          // 3. This is a new message (different from previous)
          if (
            lastMsg &&
            lastMsg.senderId !== userId &&
            (!prevConvo || 
             !prevConvo.lastMessage ||
             prevConvo.lastMessage.timestamp?.seconds !== lastMsg.timestamp?.seconds)
          ) {
            // Get sender name
            let senderName = 'Unknown';
            if (convo.type === 'group') {
              const sender = convo.participantDetails?.find(p => p.uid === lastMsg.senderId);
              senderName = sender?.displayName || 'Unknown';
            } else {
              senderName = convo.otherUser?.displayName || 'Unknown';
            }

            // Trigger notification
            useNotificationStore.getState().showNotification({
              conversationId: convo.id,
              text: lastMsg.text,
              senderName,
              timestamp: lastMsg.timestamp
            });
          }
        });
      }

      // Deduplicate: Remove any cached conversations that are now in Firestore
      // Firestore data is always the source of truth
      const firestoreIds = new Set(convos.map(c => c.id));
      
      const currentConversations = get().conversations || [];
      const cachedOnly = currentConversations.filter(
        c => c._fromCache && !firestoreIds.has(c.id)
      );
      
      // Merge: Firestore conversations + any cached ones not in Firestore yet
      const dedupedConvos = [...convos, ...cachedOnly];
      
      // Update state
      const conversationsMap = dedupedConvos.reduce((acc, convo) => {
        acc[convo.id] = convo;
        return acc;
      }, {});
      
      set({ 
        conversations: Object.values(conversationsMap),
        previousConversations: conversationsMap,
        isInitialLoad: false // Mark that we've completed the initial load
      });
    });

    return unsubscribe;
  },

  // Subscribe to messages in a conversation
  subscribeToMessages: (conversationId, userId) => {
    set({ currentConversation: conversationId });

    // 1. Load from SQLite cache first (instant display)
    database.getMessagesByConversation(conversationId).then(cachedMessages => {
      if (cachedMessages.length > 0) {
        console.log(`📦 Loaded ${cachedMessages.length} messages from cache`);
        
        // Process cached messages with pending messages
        const state = get();
        const pendingForConversation = state.pendingMessages[conversationId] || [];
        
        const cachedProcessed = cachedMessages.map(message => ({
          ...message,
          orderTimestamp: getOrderTimestamp(message),
          _fromCache: true, // Mark as cache-sourced
        }));

        const pendingProcessed = pendingForConversation.map((message) => ({
          ...message,
          orderTimestamp: getOrderTimestamp(message, state.messageMetrics[message.localId]),
        }));

        const combined = [...cachedProcessed, ...pendingProcessed].sort(
          (a, b) => (a.orderTimestamp || 0) - (b.orderTimestamp || 0)
        );
        
        set({ messages: combined });
      }
    }).catch(err => {
      console.error('Error loading cached messages:', err);
    });

    // 2. Subscribe to Firestore (for real-time updates)
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data
        };
      });

      // Cache messages to SQLite as they arrive
      for (const message of docs) {
        await database.upsertMessage({
          ...message,
          conversationId: conversationId // Add the conversation ID from the path
        });
      }

      // Mark messages as delivered for the current user
      const deliveryUpdates = [];
      docs.forEach(message => {
        if (message.senderId !== userId) {
          const deliveredTo = message.deliveredTo || [];
          if (!deliveredTo.includes(userId)) {
            const docRef = doc(db, `conversations/${conversationId}/messages/${message.id}`);
            deliveryUpdates.push(
              updateDoc(docRef, {
                deliveredTo: arrayUnion(userId),
                [`deliveredReceipts.${userId}`]: serverTimestamp()
              })
            );
          }
        }
      });

      if (deliveryUpdates.length > 0) {
        Promise.allSettled(deliveryUpdates).catch((error) => {
          console.error('Error updating delivery status:', error);
        });
      }

      const state = get();
      const pendingForConversation = state.pendingMessages[conversationId] || [];
      const metrics = { ...state.messageMetrics };
      const persistedLocalIds = new Set(
        docs
          .map(msg => msg.localId)
          .filter(Boolean)
      );

      docs.forEach((message) => {
        const localId = message.localId;
        if (!localId) return;
        const metric = metrics[localId];
        if (metric?.sentAt && !metric.deliveryLatencyMs) {
          const latency = Date.now() - metric.sentAt;
          metrics[localId] = {
            ...metric,
            deliveryLatencyMs: latency
          };
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`Message ${message.id} delivered in ${latency}ms`);
          }
        }
      });

      const filteredPending = pendingForConversation.filter(
        msg => !persistedLocalIds.has(msg.localId)
      );

      const processedDocs = docs.map((message) => {
        const localId = message.localId;
        const metric = localId ? metrics[localId] : undefined;
        const orderTimestamp = getOrderTimestamp(message, metric);
        const millis = toMillis(message.timestamp);
        const shouldFallbackTimestamp = !millis || millis <= 0;

        return {
          ...message,
          timestamp: shouldFallbackTimestamp
            ? new Date(orderTimestamp)
            : message.timestamp,
          orderTimestamp,
          deliveryLatencyMs: metric?.deliveryLatencyMs ?? message.deliveryLatencyMs
        };
      });

      const processedPending = filteredPending.map((message) => {
        const localId = message.localId;
        const metric = localId ? metrics[localId] : undefined;
        const orderTimestamp = getOrderTimestamp(message, metric);
        return {
          ...message,
          orderTimestamp
        };
      });

      const combinedMessages = [...processedDocs, ...processedPending].sort(
        (a, b) => (a.orderTimestamp || 0) - (b.orderTimestamp || 0)
      );

      set({
        messages: combinedMessages,
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: filteredPending
        },
        messageMetrics: metrics
      });
    });

    return unsubscribe;
  },

  // Create or get existing conversation
  getOrCreateConversation: async (currentUserId, otherUserId) => {
    try {
      set({ loading: true, error: null });

      // Check if DIRECT conversation already exists between these two users
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUserId)
      );

      const snapshot = await getDocs(q);
      const existingConvo = snapshot.docs.find(doc => {
        const data = doc.data();
        const participants = data.participants;
        
        // Must be a direct chat, have exactly 2 participants, and include both users
        return (
          data.type === 'direct' &&
          participants.length === 2 &&
          participants.includes(otherUserId)
        );
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

  // Create a group conversation
  createGroupConversation: async (participantIds, groupName) => {
    try {
      set({ loading: true, error: null });

      if (participantIds.length < 3) {
        console.error('Group must have at least 3 participants');
        set({ loading: false, error: 'Group must have at least 3 participants' });
        return null;
      }

      // Create new group conversation
      const newConvo = await addDoc(collection(db, 'conversations'), {
        participants: participantIds,
        type: 'group',
        name: groupName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null
      });

      set({ loading: false });
      return newConvo.id;
    } catch (error) {
      console.error('Error creating group conversation:', error);
      set({ loading: false, error: error.message });
      return null;
    }
  },

  // Send a message
  sendMessage: async (conversationId, senderId, text) => {
    const localId = tempId();

    const sentAt = Date.now();

    // Prepare optimistic message up front so we can reference it in catch blocks
    const optimisticMessage = {
      id: localId,
      localId,
      text,
      senderId,
      timestamp: new Date(),
      status: 'sending',
      conversationId,
      clientSentAt: sentAt,
      orderTimestamp: sentAt
    };

    try {
      set((state) => ({
        messages: [...state.messages, optimisticMessage],
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: [
            ...(state.pendingMessages[conversationId] || []),
            optimisticMessage
          ]
        },
        messageMetrics: {
          ...state.messageMetrics,
          [localId]: {
            conversationId,
            sentAt
          }
        }
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
          status: 'sent',
          localId,
          clientSentAt: sentAt,
          deliveredReceipts: {
            [senderId]: serverTimestamp()
          },
          readReceipts: {
            [senderId]: serverTimestamp()
          }
        }
      );

      // Update conversation's last message (fire and forget to avoid blocking UI)
      updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
          text,
          senderId,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      }).catch((err) => {
        console.error('Error updating conversation metadata:', err);
      });

      return { success: true, messageId: messageRef.id };
    } catch (error) {
      console.error('Error sending message:', error);

      set((state) => {
        const pendingForConversation = state.pendingMessages[conversationId] || [];
        const updatedPending = pendingForConversation.map(msg =>
          msg.localId === optimisticMessage.localId
            ? { ...msg, status: 'failed' }
            : msg
        );

        const updatedMessages = state.messages.map(msg =>
          msg.localId === optimisticMessage.localId
            ? { ...msg, status: 'failed' }
            : msg
        );

        const updatedMetrics = { ...state.messageMetrics };
        if (updatedMetrics[optimisticMessage.localId]) {
          updatedMetrics[optimisticMessage.localId] = {
            ...updatedMetrics[optimisticMessage.localId],
            failed: true
          };
        }

        return {
          messages: updatedMessages,
          pendingMessages: {
            ...state.pendingMessages,
            [conversationId]: updatedPending
          },
          messageMetrics: updatedMetrics
        };
      });

      return { success: false, error: error.message };
    }
  },

  // Retry a failed message
  retryMessage: async (conversationId, senderId, message) => {
    // Remove existing failed instance before retrying
    set((state) => {
      const pendingForConversation = state.pendingMessages[conversationId] || [];
      const updatedMetrics = { ...state.messageMetrics };
      delete updatedMetrics[message.localId];
      return {
        messages: state.messages.filter(msg => msg.localId !== message.localId),
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: pendingForConversation.filter(
            msg => msg.localId !== message.localId
          )
        },
        messageMetrics: updatedMetrics
      };
    });

    return await get().sendMessage(conversationId, senderId, message.text);
  },

  // Mark messages as read
  markMessagesAsRead: async (conversationId, messageIds, userId) => {
    try {
      // Filter out temp IDs and cached-only messages
      const validMessageIds = (messageIds || []).filter(
        (messageId) => messageId && !messageId.startsWith('temp_') && messageId.length > 10
      );

      if (validMessageIds.length === 0) {
        return;
      }

      // Batch updates in chunks to avoid overwhelming Firestore
      const chunkSize = 10;
      for (let i = 0; i < validMessageIds.length; i += chunkSize) {
        const chunk = validMessageIds.slice(i, i + chunkSize);
        
        const promises = chunk.map((messageId) => {
          const messageRef = doc(db, `conversations/${conversationId}/messages/${messageId}`);
          return updateDoc(messageRef, {
            readBy: arrayUnion(userId),
            [`readReceipts.${userId}`]: serverTimestamp()
          }).catch((error) => {
            // Silently skip non-existent messages (common with cache)
            // Only log in dev if it's not a "not found" error
            if (typeof __DEV__ !== 'undefined' && __DEV__ && !error.message?.includes('No document')) {
              console.warn('Read receipt update error:', error.message);
            }
          });
        });

        await Promise.allSettled(promises);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  // Clear messages when leaving chat
  clearMessages: () => {
    set((state) => {
      const activeConversation = state.currentConversation;

      if (!activeConversation) {
        return { messages: [], currentConversation: null };
      }

      const filteredMetricsEntries = Object.entries(state.messageMetrics || {}).filter(
        ([, meta]) => meta.conversationId !== activeConversation
      );

      const filteredMetrics = filteredMetricsEntries.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

      const filteredPending = { ...(state.pendingMessages || {}) };
      delete filteredPending[activeConversation];

      return {
        messages: [],
        currentConversation: null,
        messageMetrics: filteredMetrics,
        pendingMessages: filteredPending
      };
    });
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
