import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';

/**
 * Modal component to show detailed read receipt information for a message in group chats
 */
export default function MessageStatusModal({ 
  visible, 
  onClose, 
  message,
  participants,
  participantMap,
  currentUserId,
  formatTimestamp,
  styles 
}) {
  if (!visible || !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.statusModalOverlay}>
        <View style={styles.statusModalContent}>
          <View style={styles.statusModalHeader}>
            <Text style={styles.statusModalTitle}>Message Status</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.statusModalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusModalBody}>
            <Text style={styles.statusModalMessageText}>
              {message.text}
            </Text>
            <Text style={styles.statusModalTimestamp}>
              Sent {formatTimestamp(message.timestamp) || 'Pending'}
            </Text>

            <View style={styles.statusModalListHeader}>
              <Text style={[styles.statusModalListHeaderText, styles.statusModalListHeaderParticipant]}>
                Participant
              </Text>
              <Text style={[styles.statusModalListHeaderText, styles.statusModalListHeaderRead]}>
                Read Status
              </Text>
            </View>

            {participants
              .filter(uid => uid !== currentUserId)
              .map(uid => {
                const userData = participantMap[uid] || {};
                const readBy = message.readBy || [];
                const readAt = formatTimestamp(message.readReceipts?.[uid]);

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
        </View>
      </View>
    </Modal>
  );
}

