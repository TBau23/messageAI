import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { format } from 'date-fns';
import NetworkBanner from '../../../components/NetworkBanner';
import MessageStatusIndicator from '../../../components/MessageStatusIndicator';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { messages, subscribeToMessages, sendMessage, clearMessages, retryMessage } = useChatStore();
  const { setCurrentChatId } = useNotificationStore();
  const [inputText, setInputText] = useState('');
  const [conversationData, setConversationData] = useState(null);
  const [participantMap, setParticipantMap] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [showMemberList, setShowMemberList] = useState(false);
  const [selectedStatusMessage, setSelectedStatusMessage] = useState(null);
  const flatListRef = useRef(null);
  const participantSubscriptionsRef = useRef({});
  const typingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const lastTypingSignalRef = useRef(0);
  const retryingMessagesRef = useRef(new Set());

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

  // Mark messages as read when chat is viewed
  useEffect(() => {
    if (id && messages.length > 0 && user) {
      // Find unread messages (not in readBy array)
      const unreadMessages = messages.filter(
        msg => msg.senderId !== user.uid && !(msg.readBy || []).includes(user.uid)
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);
        useChatStore.getState().markMessagesAsRead(id, messageIds, user.uid);
      }
    }
  }, [id, messages, user]);

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

    const messageText = inputText.trim();
    setInputText('');

    const result = await sendMessage(id, user.uid, messageText);

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

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
        ]}
      >
        <View
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
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText,
            isMyMessage && isFailed && styles.failedMessageText
          ]}>
            {item.text}
          </Text>
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
        </View>
        {isMyMessage && !isFailed && (
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>
              {conversationData?.type === 'group' 
                ? conversationData.name || 'Group Chat'
                : otherDisplayName}
            </Text>
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

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
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
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {userData.displayName?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
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
  headerInfo: {
    flex: 1,
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
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
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
});
