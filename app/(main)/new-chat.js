import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';

export default function NewChatScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { searchUsers, getOrCreateConversation, createGroupConversation } = useChatStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupName, setGroupName] = useState('');

  const handleSearch = async (text) => {
    setSearchTerm(text);
    if (text.trim().length > 0) {
      setLoading(true);
      const results = await searchUsers(text, user.uid);
      setSearchResults(results);
      setLoading(false);
    } else {
      setSearchResults([]);
    }
  };

  const toggleUserSelection = (selectedUser) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.uid === selectedUser.uid);
      if (isSelected) {
        return prev.filter(u => u.uid !== selectedUser.uid);
      } else {
        return [...prev, selectedUser];
      }
    });
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user');
      return;
    }

    if (selectedUsers.length === 1) {
      // Direct chat
      setCreatingChat(true);
      const conversationId = await getOrCreateConversation(user.uid, selectedUsers[0].uid);
      setCreatingChat(false);
      
      if (conversationId) {
        router.replace(`/chat/${conversationId}`);
      }
    } else {
      // Group chat - show name input modal
      setShowGroupNameModal(true);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setShowGroupNameModal(false);
    setCreatingChat(true);
    
    const participantIds = [user.uid, ...selectedUsers.map(u => u.uid)];
    const conversationId = await createGroupConversation(participantIds, groupName.trim());
    
    setCreatingChat(false);
    
    if (conversationId) {
      router.replace(`/chat/${conversationId}`);
    }
  };

  const renderUser = ({ item }) => {
    const isSelected = selectedUsers.some(u => u.uid === item.uid);
    
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleUserSelection(item)}
        disabled={creatingChat}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.displayName?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName || 'Unknown User'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectedUsers.length > 0 
              ? `${selectedUsers.length} selected` 
              : 'New Chat'}
          </Text>
          {selectedUsers.length > 0 && (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreateChat}
              disabled={creatingChat}
            >
              <Text style={styles.createButtonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name..."
            value={searchTerm}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoFocus
          />
        </View>

        {selectedUsers.length > 0 && (
          <View style={styles.selectedUsersContainer}>
            <FlatList
              horizontal
              data={selectedUsers}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <View style={styles.selectedUserChip}>
                  <Text style={styles.selectedUserName}>
                    {item.displayName || 'Unknown'}
                  </Text>
                  <TouchableOpacity onPress={() => toggleUserSelection(item)}>
                    <Text style={styles.removeChip}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={styles.selectedUsersList}
            />
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#075E54" />
          </View>
        )}

        {!loading && searchTerm.length > 0 && searchResults.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        )}

        {!loading && searchTerm.length === 0 && selectedUsers.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Search for users</Text>
            <Text style={styles.emptySubtext}>Select one for direct chat or multiple for a group</Text>
          </View>
        )}

        {!loading && searchResults.length > 0 && (
          <FlatList
            data={searchResults}
            renderItem={renderUser}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Group Name Modal */}
        <Modal
          visible={showGroupNameModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowGroupNameModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Group</Text>
              <Text style={styles.modalSubtitle}>
                {selectedUsers.length + 1} participants
              </Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Group name"
                value={groupName}
                onChangeText={setGroupName}
                autoFocus
                maxLength={50}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowGroupNameModal(false);
                    setGroupName('');
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCreate]}
                  onPress={handleCreateGroup}
                >
                  <Text style={styles.modalButtonTextCreate}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {creatingChat && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>
              {selectedUsers.length > 1 ? 'Creating group...' : 'Creating chat...'}
            </Text>
          </View>
        )}
      </View>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    padding: 10,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  backText: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  createButtonText: {
    color: '#075E54',
    fontWeight: 'bold',
    fontSize: 14,
  },
  searchContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  selectedUsersContainer: {
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  selectedUsersList: {
    paddingHorizontal: 15,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  selectedUserName: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
  },
  removeChip: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#075E54',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#075E54',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
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
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#075E54',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  modalButtonCreate: {
    backgroundColor: '#075E54',
  },
  modalButtonTextCancel: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalButtonTextCreate: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
});

