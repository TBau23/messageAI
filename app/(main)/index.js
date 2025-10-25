import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { format } from 'date-fns';
import { database } from '../../utils/database';
import Avatar from '../../components/Avatar';

export default function ChatListScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { conversations, subscribeToConversations } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToConversations(user.uid);
      return () => unsubscribe();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will delete all locally cached data. Messages will be reloaded from Firestore.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.clearAllCache();
              setShowMenu(false);
              Alert.alert('Success', 'Cache cleared! Pull down to refresh.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const renderConversation = ({ item }) => {
    const lastMessageTime = item.lastMessage?.timestamp?.toDate?.();
    const timeString = lastMessageTime 
      ? format(lastMessageTime, 'h:mm a')
      : '';

    // Determine display name and avatar
    let displayName;
    let avatarText;
    
    if (item.type === 'group') {
      displayName = item.name || 'Group Chat';
      avatarText = item.name?.[0]?.toUpperCase() || 'G';
    } else {
      displayName = item.otherUser?.displayName || 'Unknown User';
      avatarText = item.otherUser?.displayName?.[0]?.toUpperCase() || '?';
    }

    // Subtitle/preview text
    let subtitleText;
    if (item.type === 'group') {
      // For groups, show last message if exists, otherwise show participant count
      subtitleText = item.lastMessage?.text || `${item.participants?.length || 0} participants`;
    } else {
      // For direct chats, show last message or empty state
      subtitleText = item.lastMessage?.text || 'No messages yet';
    }

    // Check if message is unread
    const lastMsg = item.lastMessage;
    const isUnread = lastMsg && 
                     lastMsg.senderId !== user?.uid && 
                     !(lastMsg.readBy || []).includes(user?.uid);
    
    

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        {item.type === 'group' ? (
          // For groups, use placeholder for now (will be replaced with GroupAvatar)
          <View style={[styles.avatar, styles.groupAvatar]}>
            <Text style={styles.avatarText}>{avatarText}</Text>
          </View>
        ) : (
          // For direct chats, use Avatar component with profile photo
          <Avatar
            photoURL={item.otherUser?.photoURL}
            displayName={item.otherUser?.displayName}
            userId={item.otherUser?.uid}
            size={50}
            style={{ marginRight: 15 }}
          />
        )}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationName, isUnread && styles.conversationNameUnread]}>
              {displayName}
            </Text>
            <View style={styles.timeContainer}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text style={styles.conversationTime}>{timeString}</Text>
            </View>
          </View>
          <Text style={[styles.conversationMessage, isUnread && styles.conversationMessageUnread]} numberOfLines={1}>
            {subtitleText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with New Chat button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => router.push('/new-chat')}
        >
          <Text style={styles.newChatText}>+ New Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu(!showMenu)}
        >
          <Text style={styles.menuText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {showMenu && (
        <View style={styles.menu}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setShowMenu(false);
              router.push('/profile');
            }}
          >
            <Text style={styles.menuItemText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
            <Text style={styles.menuItemText}>Clear Cache</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <Text style={styles.menuItemText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Tap "New Chat" to get started</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  newChatButton: {
    backgroundColor: '#075E54',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newChatText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  menuButton: {
    padding: 10,
  },
  menuText: {
    fontSize: 24,
    color: '#666',
  },
  menu: {
    position: 'absolute',
    top: 60,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  menuItem: {
    padding: 15,
    minWidth: 150,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  listContent: {
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupAvatar: {
    backgroundColor: '#128C7E',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  conversationNameUnread: {
    fontWeight: 'bold',
    color: '#000',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25D366',
    marginRight: 5,
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  conversationMessage: {
    fontSize: 14,
    color: '#666',
  },
  conversationMessageUnread: {
    fontWeight: '600',
    color: '#000',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

