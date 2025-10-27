import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import Avatar from '../Avatar';

/**
 * Modal component to display group chat members with their online status
 */
export default function MemberListModal({ 
  visible, 
  onClose, 
  participantMap, 
  currentUserId,
  styles 
}) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Group Members</Text>
            <TouchableOpacity onPress={onClose}>
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
                    {uid === currentUserId && ' (You)'}
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
  );
}

