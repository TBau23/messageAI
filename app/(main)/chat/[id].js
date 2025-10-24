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
import { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { format } from 'date-fns';
import NetworkBanner from '../../../components/NetworkBanner';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { messages, subscribeToMessages, sendMessage, clearMessages } = useChatStore();
  const { setCurrentChatId } = useNotificationStore();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationData, setConversationData] = useState(null);
  const [participantMap, setParticipantMap] = useState({});
  const [showMemberList, setShowMemberList] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (id && user) {
      // Set current chat to prevent notifications from this conversation
      setCurrentChatId(id);

      // Fetch conversation info
      const fetchConversation = async () => {
        const convoDoc = await getDoc(doc(db, 'conversations', id));
        if (convoDoc.exists()) {
          const convoData = convoDoc.data();
          setConversationData({ id, ...convoData });

          // Fetch all participant details for groups
          if (convoData.type === 'group') {
            const participantsData = {};
            await Promise.all(
              convoData.participants.map(async (uid) => {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                  participantsData[uid] = userDoc.data();
                }
              })
            );
            setParticipantMap(participantsData);
          } else {
            // For direct chats, just get the other user
            const otherUserId = convoData.participants.find(uid => uid !== user.uid);
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              setParticipantMap({ [otherUserId]: userDoc.data() });
            }
          }
        }
      };

      fetchConversation();
      const unsubscribe = subscribeToMessages(id);
      return () => {
        unsubscribe();
        clearMessages();
        setCurrentChatId(null); // Clear current chat when leaving
      };
    }
  }, [id, user]);

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
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    const result = await sendMessage(id, user.uid, messageText);
    setSending(false);

    if (!result.success) {
      // Show error (you could add a toast notification here)
      console.error('Failed to send message:', result.error);
    }
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

    // Calculate read receipt status
    const getReceiptStatus = () => {
      if (!isMyMessage) return null;
      if (item.status === 'sending') return { icon: '🕐', color: '#999' };
      
      const participants = conversationData?.participants || [];
      const otherParticipants = participants.filter(p => p !== user.uid);
      const readBy = item.readBy || [];
      const deliveredTo = item.deliveredTo || [];
      
      // Check if all other participants have read it
      const allRead = otherParticipants.every(p => readBy.includes(p));
      // Check if all other participants have received it
      const allDelivered = otherParticipants.every(p => deliveredTo.includes(p));
      
      if (allRead) {
        return { icon: '✓✓', color: '#4fc3f7' }; // Blue double check
      } else if (allDelivered) {
        return { icon: '✓✓', color: '#999' }; // Grey double check
      } else {
        return { icon: '✓', color: '#999' }; // Grey single check (sent)
      }
    };

    const receiptStatus = getReceiptStatus();

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          {/* Show sender name in group chats for other users' messages */}
          {isGroup && !isMyMessage && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
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
            {receiptStatus && (
              <Text style={[styles.messageStatus, { color: receiptStatus.color }]}>
                {receiptStatus.icon}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

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
                : participantMap[Object.keys(participantMap)[0]]?.displayName || 'Loading...'}
            </Text>
            {conversationData?.type === 'group' ? (
              <TouchableOpacity onPress={() => setShowMemberList(true)}>
                <Text style={styles.onlineStatus}>
                  {(() => {
                    const onlineCount = Object.values(participantMap).filter(p => p.online).length;
                    const totalCount = conversationData.participants?.length || 0;
                    return onlineCount > 0 
                      ? `${onlineCount}/${totalCount} online • Tap for members`
                      : `${totalCount} participants • Tap for members`;
                  })()}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[
                styles.onlineStatus,
                !participantMap[Object.keys(participantMap)[0]]?.online && styles.offlineStatus
              ]}>
                {participantMap[Object.keys(participantMap)[0]]?.online ? 'Online' : 'Offline'}
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
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
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
});

