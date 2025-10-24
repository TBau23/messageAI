import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';

const toDate = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatReadTime = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return format(date, 'MMM d, h:mm a');
};

export default function MessageStatusIndicator({
  message,
  isOwnMessage,
  conversationType,
  participantMap,
  currentUserId,
  onPressDetails,
}) {
  if (!isOwnMessage) return null;
  if (!message) return null;

  const status = message.status;
  if (status === 'failed') return null; // handled elsewhere with retry UI

  const participants = Object.keys(participantMap || {});
  const otherParticipants = participants.filter((uid) => uid !== currentUserId);
  const readBy = message.readBy || [];
  const deliveredTo = message.deliveredTo || [];
  const readReceipts = message.readReceipts || {};

  if (status === 'sending') {
    return (
      <View style={[styles.statusContainer, styles.pending]}>
        <Text style={styles.pendingText}>Pending…</Text>
      </View>
    );
  }

  if (conversationType !== 'group') {
    const otherUserId = otherParticipants[0];
    if (!otherUserId) {
      return (
        <View style={[styles.statusContainer, styles.sent]}>
          <Text style={styles.sentText}>Sent</Text>
        </View>
      );
    }
    const readAt = formatReadTime(readReceipts[otherUserId]);
    if (readBy.includes(otherUserId)) {
      return (
        <View style={[styles.statusContainer, styles.read]}>
          <Text style={styles.readText}>
            {readAt ? `Read at ${readAt}` : 'Read'}
          </Text>
        </View>
      );
    }

    if (deliveredTo.includes(otherUserId)) {
      return (
        <View style={[styles.statusContainer, styles.delivered]}>
          <Text style={styles.deliveredText}>Delivered</Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusContainer, styles.sent]}>
        <Text style={styles.sentText}>Sent</Text>
      </View>
    );
  }

  const totalParticipants = otherParticipants.length;
  const readCount = otherParticipants.filter((uid) => readBy.includes(uid)).length;

  if (totalParticipants <= 0) {
    return (
      <View style={[styles.statusContainer, styles.sent]}>
        <Text style={styles.sentText}>Sent</Text>
      </View>
    );
  }

  const label = `Read ${readCount}/${totalParticipants}`;
  const Wrapper = onPressDetails ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        styles.statusContainer,
        styles.group,
        onPressDetails && styles.groupInteractive,
      ]}
      onPress={onPressDetails}
      activeOpacity={0.7}
    >
      <Text style={styles.groupText}>{label}</Text>
      {onPressDetails && (
        <Text style={styles.groupHint}>View details</Text>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  pending: {
    backgroundColor: '#FFF4E5',
  },
  pendingText: {
    color: '#B26A00',
    fontSize: 12,
    fontWeight: '600',
  },
  sent: {
    backgroundColor: '#ECEFF1',
  },
  sentText: {
    color: '#546E7A',
    fontSize: 12,
    fontWeight: '600',
  },
  delivered: {
    backgroundColor: '#E3F2FD',
  },
  deliveredText: {
    color: '#1E88E5',
    fontSize: 12,
    fontWeight: '600',
  },
  read: {
    backgroundColor: '#E8F5E9',
  },
  readText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '600',
  },
  group: {
    backgroundColor: '#ECEFF1',
  },
  groupInteractive: {
    alignItems: 'flex-start',
  },
  groupText: {
    color: '#37474F',
    fontSize: 12,
    fontWeight: '600',
  },
  groupHint: {
    color: '#607D8B',
    fontSize: 10,
    marginTop: 2,
  },
});
