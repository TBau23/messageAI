import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ScrollView
} from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { useNetworkStore } from '../../../utils/networkMonitor';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { format } from 'date-fns';
import NetworkBanner from '../../../components/NetworkBanner';
import MessageStatusIndicator from '../../../components/MessageStatusIndicator';
import Avatar from '../../../components/Avatar';
import { pickImageForMessage, uploadMessageImage } from '../../../utils/imageUtils';
import { Image } from 'expo-image';
import { updateDoc } from 'firebase/firestore';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { messages, subscribeToMessages, sendMessage, clearMessages, retryMessage } = useChatStore();
  const { setCurrentChatId } = useNotificationStore();
  const { isOnline } = useNetworkStore();
  const [inputText, setInputText] = useState('');
  const [conversationData, setConversationData] = useState(null);
  const [participantMap, setParticipantMap] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [showMemberList, setShowMemberList] = useState(false);
  const [selectedStatusMessage, setSelectedStatusMessage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showEditGroupNameModal, setShowEditGroupNameModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  
  // Translation state
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [showTranslationSettings, setShowTranslationSettings] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [formality, setFormality] = useState('neutral');
  const [translationPreview, setTranslationPreview] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  
  // Language detection for received messages
  const [messageLanguages, setMessageLanguages] = useState({}); // messageId -> language code
  const [userPreferredLanguage, setUserPreferredLanguage] = useState('en');
  
  // Translation state for received messages
  const [translatedMessages, setTranslatedMessages] = useState({}); // messageId -> { text, isVisible, isLoading }
  const [translatingMessageId, setTranslatingMessageId] = useState(null);
  
  // Explanation state
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [explanationData, setExplanationData] = useState(null);
  const [explanationType, setExplanationType] = useState(null); // 'idioms' or 'cultural'
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [selectedMessageForExplanation, setSelectedMessageForExplanation] = useState(null);
  
  const flatListRef = useRef(null);
  const participantSubscriptionsRef = useRef({});
  const typingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const lastTypingSignalRef = useRef(0);
  const retryingMessagesRef = useRef(new Set());
  const isFocusedRef = useRef(false);
  const translationTimeoutRef = useRef(null);

  const toDisplayDate = useCallback((value) => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const formatReceiptTimestamp = useCallback((value) => {
    const date = toDisplayDate(value);
    if (!date) return null;
    return format(date, 'MMM d, h:mm a');
  }, [toDisplayDate]);

  const cleanupParticipantSubscriptions = useCallback(() => {
    const currentSubs = participantSubscriptionsRef.current;
    Object.keys(currentSubs).forEach((uid) => {
      currentSubs[uid]?.();
    });
    participantSubscriptionsRef.current = {};
  }, []);

  const subscribeToParticipantUpdates = useCallback((participantIds = []) => {
    const currentSubs = participantSubscriptionsRef.current;
    const nextIds = new Set(participantIds);

    // Remove old subscriptions
    Object.keys(currentSubs).forEach((uid) => {
      if (!nextIds.has(uid)) {
        currentSubs[uid]?.();
        delete currentSubs[uid];
        setParticipantMap(prev => {
          const updated = { ...prev };
          delete updated[uid];
          return updated;
        });
      }
    });

    participantIds.forEach((uid) => {
      if (!uid || currentSubs[uid]) return;

      const unsubscribe = onSnapshot(
        doc(db, 'users', uid),
        (userDoc) => {
          if (userDoc.exists()) {
            setParticipantMap(prev => ({
              ...prev,
              [uid]: { uid, ...userDoc.data() }
            }));
          }
        },
        (error) => {
          console.error('Participant subscription error:', error);
        }
      );

      currentSubs[uid] = unsubscribe;
    });
  }, []);

  const updateTypingStatus = useCallback((typing) => {
    if (!id || !user?.uid) return;

    setDoc(
      doc(db, `conversations/${id}/typingStatus/${user.uid}`),
      {
        typing,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ).catch((error) => {
      console.error('Error updating typing status:', error);
    });
  }, [id, user?.uid]);

  const isTypingEntryActive = useCallback((entry) => {
    if (!entry?.typing) return false;

    const updatedAt = entry.updatedAt;
    let updatedMs = 0;

    if (updatedAt?.toMillis) {
      updatedMs = updatedAt.toMillis();
    } else if (updatedAt instanceof Date) {
      updatedMs = updatedAt.getTime();
    } else if (typeof updatedAt === 'number') {
      updatedMs = updatedAt;
    } else {
      return false;
    }

    return Date.now() - updatedMs < 5000;
  }, []);

  const handleTextChange = (text) => {
    setInputText(text);

    if (!id || !user?.uid) return;

    const now = Date.now();

    if (!typingActiveRef.current || now - lastTypingSignalRef.current > 2000) {
      typingActiveRef.current = true;
      lastTypingSignalRef.current = now;
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      updateTypingStatus(false);
    }, 2000);

    // Handle translation preview
    if (translationEnabled && text.trim() && isOnline) {
      // Clear any existing translation timeout
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }

      // Clear previous preview and error while typing
      setTranslationPreview(null);
      setTranslationError(null);

      // Debounce translation by 1 second
      translationTimeoutRef.current = setTimeout(async () => {
        try {
          setIsTranslating(true);
          setTranslationError(null);
          
          const translateText = httpsCallable(functions, 'translateText');
          const result = await translateText({
            text: text.trim(),
            targetLanguage,
            formality
          });

          console.log('[Translation Preview]', result.data.metadata.responseTime + 'ms', 
                      'Cached:', result.data.cached);

          setTranslationPreview(result.data.translatedText);
        } catch (error) {
          console.error('[Translation Preview] Error:', error);
          setTranslationError(error.message);
        } finally {
          setIsTranslating(false);
        }
      }, 1000); // 1 second debounce
    } else {
      // Clear preview if translation is disabled, text is empty, or offline
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
      setTranslationPreview(null);
      setTranslationError(null);
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (!id || !user?.uid) return;

    setCurrentChatId(id);

    const unsubscribeMessages = subscribeToMessages(id, user.uid);

    const conversationUnsubscribe = onSnapshot(
      doc(db, 'conversations', id),
      (convoDoc) => {
        if (!convoDoc.exists()) {
          setConversationData(null);
          setParticipantMap({});
          return;
        }

        const convoData = { id, ...convoDoc.data() };
        setConversationData(convoData);
        subscribeToParticipantUpdates(convoData.participants || []);
      },
      (error) => {
        console.error('Conversation subscription error:', error);
      }
    );

    const typingUnsubscribe = onSnapshot(
      collection(db, `conversations/${id}/typingStatus`),
      (snapshot) => {
        const typingMap = {};
        snapshot.forEach((docSnap) => {
          typingMap[docSnap.id] = docSnap.data();
        });
        setTypingUsers(typingMap);
      },
      (error) => {
        console.error('Typing subscription error:', error);
      }
    );

    return () => {
      unsubscribeMessages();
      conversationUnsubscribe();
      typingUnsubscribe();
      clearMessages();
      cleanupParticipantSubscriptions();
      setParticipantMap({});
      setTypingUsers({});
      setCurrentChatId(null);
      setSelectedStatusMessage(null);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
      updateTypingStatus(false);
      typingActiveRef.current = false;
      lastTypingSignalRef.current = 0;
      retryingMessagesRef.current.clear();
    };
  }, [
    id,
    user,
    subscribeToMessages,
    clearMessages,
    setCurrentChatId,
    subscribeToParticipantUpdates,
    cleanupParticipantSubscriptions,
    updateTypingStatus
  ]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Load user's preferred language on mount
  useEffect(() => {
    const loadUserLanguagePreference = async () => {
      try {
        const getUserSettings = httpsCallable(functions, 'getUserSettings');
        const result = await getUserSettings();
        
        if (result.data.success && result.data.settings?.defaultLanguage) {
          setUserPreferredLanguage(result.data.settings.defaultLanguage);
          console.log('[Chat] User preferred language:', result.data.settings.defaultLanguage);
        }
      } catch (error) {
        console.error('[Chat] Error loading language preference:', error);
        // Fail silently, keep default 'en'
      }
    };

    if (user?.uid) {
      loadUserLanguagePreference();
    }
  }, [user?.uid]);

  // Handle offline state - disable translation features
  useEffect(() => {
    if (!isOnline) {
      // Clear translation preview when going offline
      setTranslationPreview(null);
      setTranslationError(null);
      setIsTranslating(false);
      
      // Disable translation toggle when offline
      if (translationEnabled) {
        setTranslationEnabled(false);
        console.log('[Chat] Translation disabled - offline');
      }
      
      // Clear any pending translation timeout
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
    }
  }, [isOnline, translationEnabled]);

  // Track when screen is focused
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      
      return () => {
        isFocusedRef.current = false;
      };
    }, [id])
  );

  // Mark messages as read when chat is viewed
  useEffect(() => {
    // CRITICAL: Only mark as read if the screen is actually focused
    if (!isFocusedRef.current) {
      return;
    }
    
    if (id && messages.length > 0 && user) {
      
      // Find unread messages (not in readBy array)
      // Only mark messages that are confirmed from Firestore (not cache-only)
      const unreadMessages = messages.filter(
        msg => {
          const isFromMe = msg.senderId === user.uid;
          const isAlreadyRead = (msg.readBy || []).includes(user.uid);
          const isFromCache = msg._fromCache;
          
          return !isFromMe && !isAlreadyRead && !isFromCache;
        }
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);
        useChatStore.getState().markMessagesAsRead(id, messageIds, user.uid);
      } else {
      }
    }
  }, [id, messages, user]);

  // Detect language for received messages
  useEffect(() => {
    if (!user || messages.length === 0) return;

    const detectLanguageForMessages = async () => {
      const detectMessageLanguage = httpsCallable(functions, 'detectMessageLanguage');
      
      // Find messages from other users that don't have language detected yet
      const messagesToDetect = messages.filter(msg => 
        msg.senderId !== user.uid && 
        msg.text && 
        msg.text.trim().length >= 10 &&
        !messageLanguages[msg.id]
      );

      // Detect language for each message (in parallel)
      const detectionPromises = messagesToDetect.map(async (msg) => {
        try {
          const result = await detectMessageLanguage({ text: msg.text });
          return { messageId: msg.id, language: result.data.language };
        } catch (error) {
          console.error(`[Language Detection] Failed for message ${msg.id}:`, error);
          return { messageId: msg.id, language: 'en' }; // Fallback to English
        }
      });

      const results = await Promise.all(detectionPromises);
      
      // Update state with detected languages
      if (results.length > 0) {
        const newLanguages = {};
        results.forEach(({ messageId, language }) => {
          newLanguages[messageId] = language;
        });
        
        setMessageLanguages(prev => ({ ...prev, ...newLanguages }));
      }
    };

    detectLanguageForMessages();
  }, [messages, user, messageLanguages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
    }
    updateTypingStatus(false);
    lastTypingSignalRef.current = 0;

    // Clear any pending translation timeout
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }

    // Use translated text if translation is enabled and preview exists
    const messageText = translationEnabled && translationPreview 
      ? translationPreview 
      : inputText.trim();

    // Clear input and translation state
    setInputText('');
    setTranslationPreview(null);
    setTranslationError(null);
    setIsTranslating(false);

    const result = await sendMessage(id, messageText, user.uid);

    if (!result.success) {
      // Show error (you could add a toast notification here)
      console.error('Failed to send message:', result.error);
    }
  };

  const handleRetry = async (message) => {
    if (!message?.localId) return;
    if (retryingMessagesRef.current.has(message.localId)) return;

    retryingMessagesRef.current.add(message.localId);
    const result = await retryMessage(id, user.uid, message);

    if (!result.success) {
      console.error('Retry failed:', result.error);
    }

    retryingMessagesRef.current.delete(message.localId);
  };

  const handleTranslateMessage = async (message) => {
    const messageId = message.id;
    
    // If translation already exists, toggle visibility
    if (translatedMessages[messageId]) {
      setTranslatedMessages(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          isVisible: !prev[messageId].isVisible
        }
      }));
      return;
    }

    // Start translation
    setTranslatingMessageId(messageId);
    
    try {
      const translateText = httpsCallable(functions, 'translateText');
      const result = await translateText({
        text: message.text,
        targetLanguage: userPreferredLanguage,
        formality: 'neutral'
      });

      console.log('[Message Translation]', result.data.metadata.responseTime + 'ms', 
                  'Cached:', result.data.cached);

      // Store translated text
      setTranslatedMessages(prev => ({
        ...prev,
        [messageId]: {
          text: result.data.translatedText,
          isVisible: true,
          sourceLanguage: result.data.sourceLanguage,
          cached: result.data.cached
        }
      }));
    } catch (error) {
      console.error('[Message Translation] Error:', error);
      Alert.alert('Translation Failed', error.message || 'Unable to translate message');
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const handleLongPressMessage = (message) => {
    // Don't allow explanations when offline
    if (!isOnline) {
      Alert.alert('Offline', 'Explanation features are unavailable while offline');
      return;
    }

    // Don't allow explanations for image-only messages or very short messages
    if (!message.text || message.text.trim().length < 5) {
      Alert.alert('Cannot Explain', 'Message is too short to analyze');
      return;
    }

    setSelectedMessageForExplanation(message);
    showExplanationActionSheet(message);
  };

  const showExplanationActionSheet = (message) => {
    if (Platform.OS === 'ios') {
      // Use iOS ActionSheet
      const options = [
        'Explain Idioms & Slang',
        'Explain Cultural Context',
        'Cancel'
      ];
      
      const ActionSheetIOS = require('react-native').ActionSheetIOS;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          title: 'What would you like to know?',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleExplainIdioms(message);
          } else if (buttonIndex === 1) {
            handleExplainCulturalContext(message);
          }
          setSelectedMessageForExplanation(null);
        }
      );
    } else {
      // Use Android Alert
      Alert.alert(
        'What would you like to know?',
        'Choose an explanation type',
        [
          {
            text: 'Explain Idioms & Slang',
            onPress: () => handleExplainIdioms(message)
          },
          {
            text: 'Explain Cultural Context',
            onPress: () => handleExplainCulturalContext(message)
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setSelectedMessageForExplanation(null)
          }
        ]
      );
    }
  };

  const handleExplainIdioms = async (message) => {
    setExplanationType('idioms');
    setShowExplanationModal(true);
    setIsLoadingExplanation(true);
    setExplanationData(null);

    try {
      const explainIdioms = httpsCallable(functions, 'explainIdioms');
      const result = await explainIdioms({ text: message.text });

      console.log('[Explain Idioms]', result.data.metadata?.responseTime + 'ms', 
                  'Cached:', result.data.cached, 
                  'Has idioms:', result.data.hasIdioms);

      setExplanationData({
        originalText: message.text,
        hasContent: result.data.hasIdioms,
        explanation: result.data.explanation,
        language: result.data.languageName,
        cached: result.data.cached,
        responseTime: result.data.metadata?.responseTime
      });
    } catch (error) {
      console.error('[Explain Idioms] Error:', error);
      
      // Handle specific error types
      if (error.code === 'functions/resource-exhausted') {
        Alert.alert('Daily Limit Reached', error.message);
      } else {
        Alert.alert('Explanation Failed', error.message || 'Unable to explain idioms');
      }
      
      setShowExplanationModal(false);
    } finally {
      setIsLoadingExplanation(false);
      setSelectedMessageForExplanation(null);
    }
  };

  const handleExplainCulturalContext = async (message) => {
    setExplanationType('cultural');
    setShowExplanationModal(true);
    setIsLoadingExplanation(true);
    setExplanationData(null);

    try {
      const explainCulturalContext = httpsCallable(functions, 'explainCulturalContext');
      const result = await explainCulturalContext({ text: message.text });

      console.log('[Explain Cultural Context]', result.data.metadata?.responseTime + 'ms', 
                  'Cached:', result.data.cached, 
                  'Has context:', result.data.hasContext);

      setExplanationData({
        originalText: message.text,
        hasContent: result.data.hasContext,
        explanation: result.data.explanation,
        language: result.data.languageName,
        cached: result.data.cached,
        responseTime: result.data.metadata?.responseTime
      });
    } catch (error) {
      console.error('[Explain Cultural Context] Error:', error);
      
      // Handle specific error types
      if (error.code === 'functions/resource-exhausted') {
        Alert.alert('Daily Limit Reached', error.message);
      } else {
        Alert.alert('Explanation Failed', error.message || 'Unable to explain cultural context');
      }
      
      setShowExplanationModal(false);
    } finally {
      setIsLoadingExplanation(false);
      setSelectedMessageForExplanation(null);
    }
  };

  const handleEditGroupName = () => {
    if (conversationData?.type === 'group') {
      setEditingGroupName(conversationData.name || '');
      setShowEditGroupNameModal(true);
    }
  };

  const handleSaveGroupName = async () => {
    if (!editingGroupName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    try {
      await updateDoc(doc(db, 'conversations', id), {
        name: editingGroupName.trim(),
        updatedAt: serverTimestamp()
      });
      setShowEditGroupNameModal(false);
      setEditingGroupName('');
    } catch (error) {
      console.error('Error updating group name:', error);
      Alert.alert('Error', 'Failed to update group name');
    }
  };

  // Calculate which message should show the read receipt
  // For direct chats: Find the most recent message from current user that's been read
  // For group chats: Find the most recent message from current user that's been read by anyone
  const getLastReadMessageId = () => {
    if (!user || !messages.length) return null;
    
    // Filter to only messages from current user, in reverse order (newest first)
    const myMessages = messages
      .filter(msg => msg.senderId === user.uid)
      .slice()
      .reverse();
    
    if (myMessages.length === 0) return null;
    
    if (conversationData?.type === 'group') {
      // For group chats: Find the most recent message read by at least one other participant
      const otherParticipants = Object.keys(participantMap).filter(uid => uid !== user.uid);
      
      for (const msg of myMessages) {
        const readBy = msg.readBy || [];
        const hasBeenRead = otherParticipants.some(uid => readBy.includes(uid));
        if (hasBeenRead) {
          return msg.id;
        }
      }
    } else {
      // For direct chats: Find the most recent message read by the other user
      const otherUserId = conversationData?.participants?.find(uid => uid !== user.uid);
      if (!otherUserId) return null;
      
      for (const msg of myMessages) {
        const readBy = msg.readBy || [];
        if (readBy.includes(otherUserId)) {
          return msg.id;
        }
      }
    }
    
    return null;
  };
  
  const lastReadMessageId = getLastReadMessageId();

  const renderMessage = ({ item }) => {
    if (!user) return null; // Guard against null user
    
    const isMyMessage = item.senderId === user.uid;
    const timestamp = item.timestamp?.toDate?.() || item.timestamp;
    const timeString = timestamp 
      ? format(timestamp, 'h:mm a')
      : '';

    const senderName = participantMap[item.senderId]?.displayName || 'Unknown';
    const isGroup = conversationData?.type === 'group';

    const isFailed = item.status === 'failed';
    
    // Only show read receipt on the most recently read message
    const shouldShowReadReceipt = isMyMessage && !isFailed && item.id === lastReadMessageId;
    
    // Check if message needs translation button
    const messageLanguage = messageLanguages[item.id];
    const shouldShowTranslateButton = !isMyMessage && 
                                       messageLanguage && 
                                       messageLanguage !== userPreferredLanguage &&
                                       item.text &&
                                       item.text.trim().length >= 10 &&
                                       isOnline; // Only show when online
    
    // Get translation state for this message
    const translation = translatedMessages[item.id];
    const isTranslating = translatingMessageId === item.id;
    const showTranslation = translation?.isVisible;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={500}
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            isMyMessage && isFailed && styles.failedMessageBubble
          ]}
        >
          {/* Show sender name in group chats for other users' messages */}
          {isGroup && !isMyMessage && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          
          {/* Show image if exists */}
          {item.imageURL && (
            <Image
              source={{ uri: item.imageURL }}
              style={{
                width: 200,
                height: item.imageHeight ? (200 * item.imageHeight / item.imageWidth) : 200,
                borderRadius: 8,
                marginBottom: item.text ? 8 : 0,
              }}
              contentFit="cover"
            />
          )}
          
          {/* Show text if exists */}
          {item.text && (
            <>
              <Text style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
                isMyMessage && isFailed && styles.failedMessageText,
                showTranslation && styles.originalTextDimmed
              ]}>
                {item.text}
              </Text>
              
              {/* Show translated text if available and visible */}
              {showTranslation && translation?.text && (
                <View style={styles.translatedTextContainer}>
                  <Text style={styles.translatedTextLabel}>
                    Translation:
                  </Text>
                  <Text style={styles.translatedText}>
                    {translation.text}
                  </Text>
                </View>
              )}
            </>
          )}
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {timeString}
            </Text>
          </View>
          {isMyMessage && isFailed && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => handleRetry(item)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        
        {/* Translate button for foreign language messages */}
        {shouldShowTranslateButton && (
          <TouchableOpacity
            style={[
              styles.translateButton,
              showTranslation && styles.translateButtonActive
            ]}
            onPress={() => handleTranslateMessage(item)}
            disabled={isTranslating}
          >
            <Text style={[
              styles.translateButtonText,
              showTranslation && styles.translateButtonTextActive
            ]}>
              {isTranslating 
                ? '⏳ Translating...' 
                : showTranslation 
                  ? '📄 Show Original' 
                  : '🌐 Translate'}
            </Text>
          </TouchableOpacity>
        )}
        {shouldShowReadReceipt && (
          <MessageStatusIndicator
            message={item}
            isOwnMessage={isMyMessage}
            conversationType={conversationData?.type}
            participantMap={participantMap}
            currentUserId={user.uid}
            onPressDetails={
              conversationData?.type === 'group'
                ? () => setSelectedStatusMessage(item)
                : undefined
            }
          />
        )}
      </View>
    );
  };

  const participantIds = conversationData?.participants || [];
  const otherUserId = conversationData?.type === 'group'
    ? participantIds.find(uid => uid !== user?.uid && participantMap[uid])
    : participantIds.find(uid => uid !== user?.uid);
  const otherUserData = otherUserId ? participantMap[otherUserId] : null;
  const otherIsTyping = otherUserId ? isTypingEntryActive(typingUsers[otherUserId]) : false;

  let directStatusText = 'Loading...';
  const directStatusStyles = [styles.onlineStatus];
  if (otherIsTyping) {
    directStatusText = 'Typing...';
    directStatusStyles.push(styles.typingStatus);
  } else if (typeof otherUserData?.online === 'boolean') {
    directStatusText = otherUserData.online ? 'Online' : 'Offline';
    if (!otherUserData.online) {
      directStatusStyles.push(styles.offlineStatus);
    }
  }
  const otherDisplayName = otherUserData?.displayName || 'Loading...';

  const groupParticipants = conversationData?.type === 'group' ? participantIds : [];
  const typingMemberIds = groupParticipants.filter(
    uid => uid !== user?.uid && isTypingEntryActive(typingUsers[uid])
  );
  const groupStatusStyles = [styles.onlineStatus];
  let groupStatusText = 'Tap for members';

  if (conversationData?.type === 'group') {
    if (typingMemberIds.length > 0) {
      const typingNames = typingMemberIds
        .map(uid => participantMap[uid]?.displayName || 'Someone');
      const displayNames = typingNames.slice(0, 2).join(', ');
      const extraCount = typingNames.length - 2;
      const suffix = typingNames.length > 1 ? ' are typing...' : ' is typing...';
      groupStatusText = `${displayNames}${extraCount > 0 ? ` +${extraCount}` : ''}${suffix}`;
      groupStatusStyles.push(styles.typingStatus);
    } else {
      const totalCount = groupParticipants.length;
      const onlineCount = groupParticipants.filter(uid => participantMap[uid]?.online).length;
      groupStatusText = totalCount > 0
        ? `${onlineCount}/${totalCount} online • Tap for members`
        : 'Tap for members';
      if (onlineCount === 0) {
        groupStatusStyles.push(styles.offlineStatus);
      }
    }
  }

  // Show loading if user isn't loaded yet
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#666' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          
          {/* Avatar */}
          {conversationData?.type === 'group' ? (
            // Group placeholder (will be replaced with GroupAvatar later)
            <View style={styles.headerAvatar}>
              <View style={[styles.placeholderAvatar, { backgroundColor: '#128C7E' }]}>
                <Text style={styles.placeholderText}>
                  {(conversationData.name?.[0] || 'G').toUpperCase()}
                </Text>
              </View>
            </View>
          ) : (
            // Direct chat - show other user's avatar
            conversationData && otherUserId && (
              <Avatar
                photoURL={participantMap[otherUserId]?.photoURL}
                displayName={otherDisplayName}
                userId={otherUserId}
                size={40}
              />
            )
          )}
          
          <View style={styles.headerInfo}>
            {conversationData?.type === 'group' ? (
              <TouchableOpacity onPress={handleEditGroupName}>
                <Text style={styles.headerName}>
                  {conversationData.name || 'Group Chat'} ✏️
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.headerName}>
                {otherDisplayName}
              </Text>
            )}
            {conversationData?.type === 'group' ? (
              <TouchableOpacity onPress={() => setShowMemberList(true)}>
                <Text style={groupStatusStyles}>
                  {groupStatusText}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={directStatusStyles}>
                {directStatusText}
              </Text>
            )}
          </View>
        </View>

      {/* Network Status Banner */}
      <NetworkBanner />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Image Preview */}
      {selectedImage && (
        <View style={styles.imagePreview}>
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} contentFit="cover" />
          <TouchableOpacity style={styles.removeImage} onPress={() => setSelectedImage(null)}>
            <Text style={styles.removeImageText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.imageButton} 
          onPress={async () => {
            const image = await pickImageForMessage();
            if (image) {
              setSelectedImage(image);
            }
          }}
          disabled={isUploadingImage}
        >
          <Text style={styles.imageButtonText}>📷</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.translationButton, 
            translationEnabled && styles.translationButtonActive,
            !isOnline && styles.translationButtonDisabled
          ]} 
          onPress={() => {
            if (!isOnline) {
              Alert.alert('Offline', 'Translation is unavailable while offline');
              return;
            }
            if (translationEnabled) {
              // If already enabled, toggle settings
              setShowTranslationSettings(!showTranslationSettings);
            } else {
              // If disabled, enable and show settings
              setTranslationEnabled(true);
              setShowTranslationSettings(true);
            }
          }}
          disabled={!isOnline}
        >
          <Text style={[
            styles.translationButtonText,
            !isOnline && styles.translationButtonTextDisabled
          ]}>🌐</Text>
        </TouchableOpacity>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
            editable={!isUploadingImage}
          />
          
          {/* Translation Preview */}
          {translationEnabled && (isTranslating || translationPreview || translationError) && (
            <View style={styles.translationPreviewContainer}>
              {isTranslating && (
                <Text style={styles.translationPreviewLoading}>
                  🔄 Translating...
                </Text>
              )}
              {translationPreview && !isTranslating && (
                <View style={styles.translationPreviewContent}>
                  <Text style={styles.translationPreviewLabel}>
                    Translation → {targetLanguage.toUpperCase()}:
                  </Text>
                  <Text style={styles.translationPreviewText}>
                    {translationPreview}
                  </Text>
                </View>
              )}
              {translationError && !isTranslating && (
                <Text style={styles.translationPreviewError}>
                  ⚠️ {translationError}
                </Text>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() && !selectedImage) && styles.sendButtonDisabled]}
          onPress={async () => {
            if (selectedImage) {
              setIsUploadingImage(true);
              try {
                const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const { downloadURL, width, height } = await uploadMessageImage(
                  selectedImage.uri,
                  id,
                  messageId
                );
                
                // Send message with image
                await sendMessage(id, inputText.trim() || '', user.uid, {
                  imageURL: downloadURL,
                  imageWidth: width,
                  imageHeight: height,
                });
                
                setInputText('');
                setSelectedImage(null);
              } catch (error) {
                Alert.alert('Error', 'Failed to send image: ' + error.message);
              } finally {
                setIsUploadingImage(false);
              }
            } else {
              handleSend();
            }
          }}
          disabled={(!inputText.trim() && !selectedImage) || isUploadingImage}
        >
          <Text style={styles.sendButtonText}>
            {isUploadingImage ? '...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Member List Modal for Groups */}
      <Modal
        visible={showMemberList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMemberList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Members</Text>
              <TouchableOpacity onPress={() => setShowMemberList(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={Object.entries(participantMap)}
              keyExtractor={([uid]) => uid}
              renderItem={({ item: [uid, userData] }) => (
                <View style={styles.memberItem}>
                  <Avatar
                    photoURL={userData.photoURL}
                    displayName={userData.displayName}
                    userId={uid}
                    size={45}
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {userData.displayName || 'Unknown'}
                      {uid === user.uid && ' (You)'}
                    </Text>
                    <View style={styles.memberStatusContainer}>
                      <View style={[
                        styles.statusDot,
                        userData.online ? styles.statusDotOnline : styles.statusDotOffline
                      ]} />
                      <Text style={styles.memberStatus}>
                        {userData.online ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              style={styles.memberList}
            />
          </View>
        </View>
      </Modal>

      {/* Edit Group Name Modal */}
      <Modal
        visible={showEditGroupNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditGroupNameModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editGroupModalOverlay}
        >
          <TouchableOpacity 
            style={styles.editGroupModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowEditGroupNameModal(false)}
          />
          <View style={styles.editGroupModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Group Name</Text>
              <TouchableOpacity onPress={() => setShowEditGroupNameModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.groupNameInput}
              value={editingGroupName}
              onChangeText={setEditingGroupName}
              placeholder="Group name"
              autoFocus
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={handleSaveGroupName}
            />
            
            <TouchableOpacity
              style={styles.saveGroupNameButton}
              onPress={handleSaveGroupName}
            >
              <Text style={styles.saveGroupNameButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Translation Settings Modal */}
      <Modal
        visible={showTranslationSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTranslationSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.translationSettingsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Translation Settings</Text>
              <TouchableOpacity onPress={() => setShowTranslationSettings(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Translation On/Off Toggle */}
            <View style={styles.translationSettingRow}>
              <Text style={styles.translationSettingLabel}>Translation Enabled</Text>
              <TouchableOpacity
                style={[styles.translationToggle, translationEnabled && styles.translationToggleActive]}
                onPress={() => setTranslationEnabled(!translationEnabled)}
              >
                <View style={[styles.translationToggleThumb, translationEnabled && styles.translationToggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {translationEnabled && (
              <>
                {/* Language Selector */}
                <View style={styles.translationSettingSection}>
                  <Text style={styles.translationSectionTitle}>Target Language</Text>
                  <View style={styles.languageGrid}>
                    {[
                      { code: 'en', name: 'English', flag: '🇬🇧' },
                      { code: 'es', name: 'Spanish', flag: '🇪🇸' },
                      { code: 'fr', name: 'French', flag: '🇫🇷' },
                      { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
                      { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
                      { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
                    ].map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        style={[
                          styles.languageOption,
                          targetLanguage === lang.code && styles.languageOptionSelected
                        ]}
                        onPress={() => setTargetLanguage(lang.code)}
                      >
                        <Text style={styles.languageFlag}>{lang.flag}</Text>
                        <Text style={[
                          styles.languageName,
                          targetLanguage === lang.code && styles.languageNameSelected
                        ]}>
                          {lang.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Formality Selector */}
                <View style={styles.translationSettingSection}>
                  <Text style={styles.translationSectionTitle}>Formality Level</Text>
                  <View style={styles.formalityRow}>
                    {[
                      { value: 'casual', label: 'Casual', icon: '😊' },
                      { value: 'neutral', label: 'Neutral', icon: '📝' },
                      { value: 'formal', label: 'Formal', icon: '👔' },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.formalityOption,
                          formality === option.value && styles.formalityOptionSelected
                        ]}
                        onPress={() => setFormality(option.value)}
                      >
                        <Text style={styles.formalityIcon}>{option.icon}</Text>
                        <Text style={[
                          styles.formalityLabel,
                          formality === option.value && styles.formalityLabelSelected
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.translationSettingsCloseButton}
              onPress={() => setShowTranslationSettings(false)}
            >
              <Text style={styles.translationSettingsCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Explanation Modal */}
      <Modal
        visible={showExplanationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExplanationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.explanationModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {explanationType === 'idioms' ? '💬 Idiom Explanation' : '🌍 Cultural Context'}
              </Text>
              <TouchableOpacity onPress={() => setShowExplanationModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Loading state */}
            {isLoadingExplanation && (
              <View style={styles.explanationLoading}>
                <Text style={styles.explanationLoadingText}>⏳ Analyzing message...</Text>
              </View>
            )}

            {/* Explanation content */}
            {!isLoadingExplanation && explanationData && (
              <ScrollView style={styles.explanationContent}>
                {/* Original message reference */}
                <View style={styles.explanationOriginalMessage}>
                  <Text style={styles.explanationOriginalLabel}>Original Message:</Text>
                  <Text style={styles.explanationOriginalText}>
                    {explanationData.originalText}
                  </Text>
                  {explanationData.language && (
                    <Text style={styles.explanationLanguageLabel}>
                      Language: {explanationData.language}
                    </Text>
                  )}
                </View>

                {/* Explanation or "not found" message */}
                {explanationData.hasContent ? (
                  <View style={styles.explanationTextContainer}>
                    <Text style={styles.explanationText}>
                      {explanationData.explanation}
                    </Text>
                    {explanationData.cached && (
                      <Text style={styles.explanationCacheNote}>
                        📦 From cache ({explanationData.responseTime}ms)
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.explanationNoContent}>
                    <Text style={styles.explanationNoContentText}>
                      {explanationType === 'idioms' 
                        ? '✓ No idioms or slang expressions found in this message.'
                        : '✓ No specific cultural context needed for this message.'}
                    </Text>
                    <Text style={styles.explanationNoContentSubtext}>
                      This appears to be straightforward communication.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.explanationDismissButton}
              onPress={() => setShowExplanationModal(false)}
            >
              <Text style={styles.explanationDismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delivery / Read Detail Modal */}
      <Modal
        visible={!!selectedStatusMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStatusMessage(null)}
      >
        <View style={styles.statusModalOverlay}>
          <View style={styles.statusModalContent}>
            <View style={styles.statusModalHeader}>
              <Text style={styles.statusModalTitle}>Message Status</Text>
              <TouchableOpacity onPress={() => setSelectedStatusMessage(null)}>
                <Text style={styles.statusModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedStatusMessage && (
              <View style={styles.statusModalBody}>
                <Text style={styles.statusModalMessageText}>
                  {selectedStatusMessage.text}
                </Text>
                <Text style={styles.statusModalTimestamp}>
                  Sent {formatReceiptTimestamp(selectedStatusMessage.timestamp) || 'Pending'}
                </Text>

                <View style={styles.statusModalListHeader}>
                  <Text style={[styles.statusModalListHeaderText, styles.statusModalListHeaderParticipant]}>
                    Participant
                  </Text>
                  <Text style={[styles.statusModalListHeaderText, styles.statusModalListHeaderRead]}>
                    Read Status
                  </Text>
                </View>

                {(conversationData?.participants || [])
                  .filter(uid => uid !== user?.uid)
                  .map(uid => {
                    const userData = participantMap[uid] || {};
                    const readBy = selectedStatusMessage.readBy || [];
                    const readAt = formatReceiptTimestamp(
                      selectedStatusMessage.readReceipts?.[uid]
                    );

                    const readLabel = readBy.includes(uid)
                      ? readAt ? `Read at ${readAt}` : 'Read'
                      : 'Not read';

                    return (
                      <View key={uid} style={styles.statusModalRow}>
                        <Text style={[styles.statusModalParticipant, styles.statusModalParticipantCell]}>
                          {userData.displayName || 'Unknown'}
                        </Text>
                        <Text style={styles.statusModalRead}>{readLabel}</Text>
                      </View>
                    );
                  })}
              </View>
            )}
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#075E54',
  },
  container: {
    flex: 1,
    backgroundColor: '#e5ddd5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    padding: 10,
    paddingTop: 10,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  backText: {
    color: '#fff',
    fontSize: 24,
  },
  headerAvatar: {
    marginRight: 10,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineStatus: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  offlineStatus: {
    color: '#999',
  },
  typingStatus: {
    color: '#c8e6ff',
  },
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    marginBottom: 10,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 8,
  },
  myMessageBubble: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
  },
  failedMessageBubble: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#075E54',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#000',
  },
  failedMessageText: {
    color: '#b71c1c',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  myMessageTime: {
    color: '#666',
  },
  otherMessageTime: {
    color: '#999',
  },
  messageStatus: {
    fontSize: 12,
    color: '#666',
  },
  failedMessageStatus: {
    fontWeight: 'bold',
  },
  imagePreview: {
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  removeImage: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  imageButton: {
    padding: 10,
    marginRight: 5,
  },
  imageButtonText: {
    fontSize: 24,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#075E54',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8b5b1',
  },
  retryButtonText: {
    color: '#8b0000',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#075E54',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  memberList: {
    paddingHorizontal: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#4caf50',
  },
  statusDotOffline: {
    backgroundColor: '#999',
  },
  memberStatus: {
    fontSize: 13,
    color: '#666',
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
  },
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#075E54',
  },
  statusModalClose: {
    fontSize: 22,
    color: '#666',
    fontWeight: 'bold',
  },
  statusModalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statusModalMessageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  statusModalTimestamp: {
    fontSize: 12,
    color: '#777',
    marginBottom: 16,
  },
  statusModalListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusModalListHeaderText: {
    color: '#607D8B',
    fontSize: 12,
    fontWeight: '700',
  },
  statusModalListHeaderParticipant: {
    flex: 1.4,
  },
  statusModalListHeaderRead: {
    flex: 1,
    textAlign: 'right',
  },
  statusModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f4',
  },
  statusModalParticipant: {
    color: '#37474F',
    fontSize: 14,
    fontWeight: '600',
  },
  statusModalParticipantCell: {
    flex: 1.4,
  },
  statusModalRead: {
    flex: 1,
    color: '#2E7D32',
    fontSize: 12,
    textAlign: 'right',
  },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    marginTop: 10,
    marginHorizontal: 20,
  },
  saveGroupNameButton: {
    backgroundColor: '#075E54',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  saveGroupNameButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editGroupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editGroupModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  editGroupModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  // Translation UI styles
  translationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  translationButtonActive: {
    backgroundColor: '#075E54',
  },
  translationButtonDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.5,
  },
  translationButtonText: {
    fontSize: 20,
  },
  translationButtonTextDisabled: {
    opacity: 0.5,
  },
  translationSettingsModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  translationSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  translationSettingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  translationToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    padding: 2,
    justifyContent: 'center',
  },
  translationToggleActive: {
    backgroundColor: '#075E54',
  },
  translationToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  translationToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  translationSettingSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  translationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languageOption: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  languageOptionSelected: {
    borderColor: '#075E54',
    borderWidth: 2,
    backgroundColor: '#E8F5E9',
  },
  languageFlag: {
    fontSize: 24,
    marginBottom: 4,
  },
  languageName: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  languageNameSelected: {
    fontWeight: 'bold',
    color: '#075E54',
  },
  formalityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formalityOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  formalityOptionSelected: {
    borderColor: '#075E54',
    borderWidth: 2,
    backgroundColor: '#E8F5E9',
  },
  formalityIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  formalityLabel: {
    fontSize: 13,
    color: '#333',
  },
  formalityLabelSelected: {
    fontWeight: 'bold',
    color: '#075E54',
  },
  translationSettingsCloseButton: {
    backgroundColor: '#075E54',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  translationSettingsCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Translation Preview styles
  inputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  translationPreviewContainer: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#075E54',
  },
  translationPreviewLoading: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  translationPreviewContent: {
    gap: 2,
  },
  translationPreviewLabel: {
    fontSize: 11,
    color: '#075E54',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  translationPreviewText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  translationPreviewError: {
    fontSize: 13,
    color: '#d32f2f',
    fontStyle: 'italic',
  },
  // Translate button for received messages
  translateButton: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#075E54',
    alignSelf: 'flex-start',
  },
  translateButtonActive: {
    backgroundColor: '#075E54',
  },
  translateButtonText: {
    color: '#075E54',
    fontSize: 12,
    fontWeight: '600',
  },
  translateButtonTextActive: {
    color: '#fff',
  },
  // Translated text styles
  originalTextDimmed: {
    opacity: 0.6,
  },
  translatedTextContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  translatedTextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#075E54',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  translatedText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  // Explanation Modal styles
  explanationModal: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  explanationLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationLoadingText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  explanationContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexGrow: 1,
  },
  explanationOriginalMessage: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#075E54',
  },
  explanationOriginalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  explanationOriginalText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 6,
  },
  explanationLanguageLabel: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  explanationTextContainer: {
    paddingVertical: 8,
  },
  explanationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
    marginBottom: 12,
  },
  explanationCacheNote: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  explanationNoContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  explanationNoContentText: {
    fontSize: 15,
    color: '#4caf50',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  explanationNoContentSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  explanationDismissButton: {
    backgroundColor: '#075E54',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  explanationDismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
