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
import { sendPushNotification, setBadgeCount } from '../utils/notifications';

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
  unreadCount: 0, // Total unread messages across all conversations
  processedDeliveryReceipts: new Set(), // Track which messages already have delivery receipts to avoid infinite loops

  // Subscribe to user's conversations
  subscribeToConversations: (userId) => {

    
    // Reset initial load flag when subscribing
    set({ isInitialLoad: true });
    
    // 1. Load from SQLite cache first (instant display)
    database.getConversations().then(async (cachedConversations) => {
      if (cachedConversations.length > 0) {
        
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
        
        // Deduplicate cache data before setting state (in case SQLite has duplicates)
        const cacheConvoMap = processedConvos.reduce((acc, convo) => {
          acc[convo.id] = convo;
          return acc;
        }, {});
        const dedupedCacheConvos = Object.values(cacheConvoMap);
        
        if (processedConvos.length !== dedupedCacheConvos.length) {
          console.warn('⚠️ Found duplicate conversations in cache!');
        }
        
        set({ conversations: dedupedCacheConvos });
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
      
      // Update state with deduplication
      const conversationsMap = dedupedConvos.reduce((acc, convo) => {
        acc[convo.id] = convo;
        return acc;
      }, {});
      
      const finalConvos = Object.values(conversationsMap);
      
      if (dedupedConvos.length !== finalConvos.length) {
        console.warn('⚠️ Found duplicates during Firestore merge!');
        console.warn('Duplicate IDs:', dedupedConvos.map(c => c.id).filter((id, idx, arr) => arr.indexOf(id) !== idx));
      }
      
      set({ 
        conversations: finalConvos,
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
        
        // CRITICAL: Check if this conversation is still active before setting messages
        const state = get();
        if (state.currentConversation !== conversationId) {
          console.warn(`⚠️ Ignoring cached messages for ${conversationId} - conversation changed to ${state.currentConversation}`);
          return;
        }
        
        // Process cached messages with pending messages
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
      console.log(`[subscribeToMessages] Firestore snapshot received for ${conversationId}, ${snapshot.docs.length} messages`);
      
      // CRITICAL: Check if this conversation is still active before processing
      let currentState = get();
      if (currentState.currentConversation !== conversationId) {
        console.warn(`⚠️ Ignoring Firestore update for ${conversationId} - conversation changed to ${currentState.currentConversation}`);
        return;
      }
      
      console.log(`[subscribeToMessages] Processing snapshot, currentConversation: ${currentState.currentConversation}`);
      
      const docs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data
        };
      });
      
      console.log(`[subscribeToMessages] Mapped ${docs.length} documents from snapshot`);

      // Cache messages to SQLite as they arrive
      for (const message of docs) {
        await database.upsertMessage({
          ...message,
          conversationId: conversationId // Add the conversation ID from the path
        });
      }

      // Mark messages as delivered for the current user
      // CRITICAL: Only mark as delivered ONCE per message to avoid infinite loops
      const deliveryUpdates = [];
      const state = get();
      const processedDeliveryReceipts = state.processedDeliveryReceipts || new Set();
      
      docs.forEach(message => {
        if (message.senderId !== userId) {
          const deliveredTo = message.deliveredTo || [];
          // Check both: not already in Firestore AND not already processed in this session
          if (!deliveredTo.includes(userId) && !processedDeliveryReceipts.has(message.id)) {
            const docRef = doc(db, `conversations/${conversationId}/messages/${message.id}`);
            deliveryUpdates.push(
              updateDoc(docRef, {
                deliveredTo: arrayUnion(userId),
                [`deliveredReceipts.${userId}`]: serverTimestamp()
              })
            );
            // Mark as processed immediately to prevent duplicate updates
            processedDeliveryReceipts.add(message.id);
          }
        }
      });

      if (deliveryUpdates.length > 0) {
        console.log(`[subscribeToMessages] Updating delivery receipts for ${deliveryUpdates.length} messages`);
        // Update state with processed receipts
        set({ processedDeliveryReceipts });
        
        Promise.allSettled(deliveryUpdates).catch((error) => {
          console.error('Error updating delivery status:', error);
        });
      }

      // Get fresh state for pending message processing
      currentState = get();
      const pendingForConversation = currentState.pendingMessages[conversationId] || [];
      const metrics = { ...currentState.messageMetrics };
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

      // CRITICAL: Final check before setting messages
      // Re-check state in case conversation changed during async operations
      const finalState = get();
      if (finalState.currentConversation !== conversationId) {
        console.warn(`⚠️ Ignoring final message set for ${conversationId} - conversation changed to ${finalState.currentConversation}`);
        return;
      }

      console.log(`[subscribeToMessages] Setting ${combinedMessages.length} messages in state (${processedDocs.length} from Firestore + ${processedPending.length} pending)`);
      
      set({
        messages: combinedMessages,
        pendingMessages: {
          ...currentState.pendingMessages,
          [conversationId]: filteredPending
        },
        messageMetrics: metrics
      });
      
      console.log(`[subscribeToMessages] ✅ State updated, total messages now: ${get().messages.length}`);
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

  // Send a message (with optional image data)
  sendMessage: async (conversationId, text, senderId, imageData = null) => {
    console.log(`[sendMessage] Starting send for conversation ${conversationId}`);
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
      orderTimestamp: sentAt,
      ...(imageData && {
        imageURL: imageData.imageURL,
        imageWidth: imageData.imageWidth,
        imageHeight: imageData.imageHeight,
      }),
    };

    try {
      console.log(`[sendMessage] Adding optimistic message to state, localId: ${localId}`);
      const currentState = get();
      console.log(`[sendMessage] Current messages count: ${currentState.messages.length}`);
      console.log(`[sendMessage] Current conversation: ${currentState.currentConversation}`);
      
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
      
      console.log(`[sendMessage] Optimistic message added, new count: ${get().messages.length}`);

      // Send to Firestore
      console.log(`[sendMessage] Writing to Firestore: conversations/${conversationId}/messages`);
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
          },
          ...(imageData && {
            imageURL: imageData.imageURL,
            imageWidth: imageData.imageWidth,
            imageHeight: imageData.imageHeight,
          }),
        }
      );
      
      console.log(`[sendMessage] ✅ Message written to Firestore with ID: ${messageRef.id}`);

      // Update conversation's last message (fire and forget to avoid blocking UI)
      updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
          text,
          senderId,
          timestamp: serverTimestamp(),
          readBy: [senderId]  // Sender has read their own message
        },
        updatedAt: serverTimestamp()
      }).catch((err) => {
        console.error('Error updating conversation metadata:', err);
      });

      // Send push notifications to recipients (fire and forget)
      // Get sender name for notification
      const senderDoc = await getDoc(doc(db, 'users', senderId));
      const senderName = senderDoc.exists() 
        ? senderDoc.data().displayName || 'Someone'
        : 'Someone';
      
      get().sendPushToRecipients(conversationId, senderName, text, senderId).catch((err) => {
        console.error('Error sending push notifications:', err);
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

    return await get().sendMessage(conversationId, message.text, senderId);
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

      // Update the conversation's lastMessage.readBy if we're marking the most recent message
      // This ensures the chat list shows the correct unread status
      try {
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (conversationSnap.exists()) {
          const conversationData = conversationSnap.data();
          const lastMessage = conversationData.lastMessage;
          
          // Check if any of the messages we just marked as read matches the lastMessage
          // We need to get the actual message to find its localId or compare other fields
          if (lastMessage && validMessageIds.length > 0) {
            // Get the most recent message from our local state or fetch it
            const messages = get().messages;
            const mostRecentMarkedMessage = messages
              .filter(msg => validMessageIds.includes(msg.id))
              .sort((a, b) => {
                const aTime = toMillis(a.timestamp) || 0;
                const bTime = toMillis(b.timestamp) || 0;
                return bTime - aTime;
              })[0];

            // If the most recent marked message matches the conversation's last message timestamp,
            // update the lastMessage.readBy array
            if (mostRecentMarkedMessage) {
              const lastMsgTime = toMillis(lastMessage.timestamp);
              const markedMsgTime = toMillis(mostRecentMarkedMessage.timestamp);
              
              // Allow 1 second tolerance for timestamp comparison
              if (lastMsgTime && markedMsgTime && Math.abs(lastMsgTime - markedMsgTime) < 1000) {

                await updateDoc(conversationRef, {
                  'lastMessage.readBy': arrayUnion(userId)
                });

              } 
            }
          }
        }
      } catch (error) {
        // Non-critical error - don't throw, just log
        console.warn('Could not update conversation lastMessage.readBy:', error.message);
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
        return { 
          messages: [], 
          currentConversation: null,
          processedDeliveryReceipts: new Set() // Clear delivery receipt tracking
        };
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
        pendingMessages: filteredPending,
        processedDeliveryReceipts: new Set() // Clear delivery receipt tracking when changing conversations
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
  },

  // Calculate unread message count across all conversations
  calculateUnreadCount: (userId) => {
    const { conversations, currentConversation } = get();
    let totalUnread = 0;

    conversations.forEach(convo => {
      // Skip currently open conversation (those messages are "read")
      if (convo.id === currentConversation) {
        return;
      }

      const lastMsg = convo.lastMessage;
      if (lastMsg && lastMsg.senderId !== userId) {
        // Check if user has read this message
        const readBy = lastMsg.readBy || [];
        if (!readBy.includes(userId)) {
          totalUnread++;
        }
      }
    });

    return totalUnread;
  },

  // Update badge count
  updateBadgeCount: async (userId) => {
    try {
      const unreadCount = get().calculateUnreadCount(userId);
      set({ unreadCount });
      await setBadgeCount(unreadCount);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  },

  // Send push notification to recipients
  sendPushToRecipients: async (conversationId, senderName, messageText, senderId) => {
    try {
      
      // Get conversation data
      const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
      if (!conversationDoc.exists()) {

        return;
      }

      const conversationData = conversationDoc.data();
      const participants = conversationData.participants || [];

      // Get recipients (exclude sender)
      const recipients = participants.filter(id => id !== senderId);


      // Send push to each recipient
      for (const recipientId of recipients) {
        
        // Get recipient's push token
        const recipientDoc = await getDoc(doc(db, 'users', recipientId));
        if (!recipientDoc.exists()) {
          continue;
        }

        const recipientData = recipientDoc.data();
        const pushToken = recipientData.pushToken;

        if (!pushToken) {
          console.log(`⚠️ No push token for user ${recipientId}`);
          continue;
        }

        console.log(`✅ Push token found: ${pushToken.substring(0, 30)}...`);

        // Send push notification (always send, let the system handle delivery)
        // The in-app notification suppression happens on the receiving device
        const badgeCount = 1;

        console.log(`📤 Sending push notification to ${recipientId}...`);
        const success = await sendPushNotification(pushToken, {
          title: senderName,
          body: messageText,
          data: { conversationId },
          badge: badgeCount,
        });

        if (success) {
          console.log(`✅ Push notification sent successfully to ${recipientId}`);
        } else {
          console.log(`❌ Failed to send push notification to ${recipientId}`);
        }
      }
      
      console.log(`✅ Push notification batch complete\n`);
    } catch (error) {
      console.error('❌ Error sending push notifications:', error);
      // Don't throw - push notification failures shouldn't block message sending
    }
  },
}));
