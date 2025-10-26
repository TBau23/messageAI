import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import MessageStatusIndicator from '../MessageStatusIndicator';

/**
 * Memoized message bubble component for optimal FlatList performance.
 * Only re-renders when message data or critical display props change.
 */
const MessageBubble = memo(({
  message,
  currentUserId,
  participantMap,
  conversationType,
  lastReadMessageId,
  messageLanguages,
  translatedMessages,
  translatingMessageId,
  userPreferredLanguage,
  isOnline,
  onLongPress,
  onTranslate,
  onRetry,
  onPressStatusDetails,
  styles,
}) => {
  // Compute display values
  const isMyMessage = message.senderId === currentUserId;
  const timestamp = message.timestamp?.toDate?.() || message.timestamp;
  const timeString = timestamp ? format(timestamp, 'h:mm a') : '';
  const senderName = participantMap[message.senderId]?.displayName || 'Unknown';
  const isGroup = conversationType === 'group';
  const isFailed = message.status === 'failed';
  
  // Only show read receipt on the most recently read message
  const shouldShowReadReceipt = isMyMessage && !isFailed && message.id === lastReadMessageId;
  
  // Check if message needs translation button
  const messageLanguage = messageLanguages[message.id];
  const shouldShowTranslateButton = !isMyMessage && 
                                     messageLanguage && 
                                     messageLanguage !== userPreferredLanguage &&
                                     message.text &&
                                     message.text.trim().length >= 10 &&
                                     isOnline;
  
  // Get translation state for this message
  const translation = translatedMessages[message.id];
  const isTranslating = translatingMessageId === message.id;
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
        onLongPress={() => onLongPress(message)}
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
        {message.imageURL && (
          <Image
            source={{ uri: message.imageURL }}
            style={{
              width: 200,
              height: message.imageHeight ? (200 * message.imageHeight / message.imageWidth) : 200,
              borderRadius: 8,
              marginBottom: message.text ? 8 : 0,
            }}
            contentFit="cover"
          />
        )}
        
        {/* Show text if exists */}
        {message.text && (
          <>
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              isMyMessage && isFailed && styles.failedMessageText,
              showTranslation && styles.originalTextDimmed
            ]}>
              {message.text}
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
            onPress={() => onRetry(message)}
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
          onPress={() => onTranslate(message)}
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
          message={message}
          isOwnMessage={isMyMessage}
          conversationType={conversationType}
          participantMap={participantMap}
          currentUserId={currentUserId}
          onPressDetails={
            conversationType === 'group'
              ? () => onPressStatusDetails(message)
              : undefined
          }
        />
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal re-render prevention
  // Only re-render if these critical props change
  
  const message = prevProps.message;
  const nextMessage = nextProps.message;
  
  // Message content changes
  if (message.id !== nextMessage.id) return false;
  if (message.text !== nextMessage.text) return false;
  if (message.status !== nextMessage.status) return false;
  if (message.imageURL !== nextMessage.imageURL) return false;
  
  // Read receipt changes - need to check if THIS message's receipt status changed
  // This is critical for group chats where read receipts update frequently
  const prevReadBy = JSON.stringify(message.readBy || []);
  const nextReadBy = JSON.stringify(nextMessage.readBy || []);
  if (prevReadBy !== nextReadBy) return false;
  
  // Also check if this message was or is the last read message (for showing indicator)
  const wasLastRead = prevProps.lastReadMessageId === message.id;
  const isLastRead = nextProps.lastReadMessageId === message.id;
  if (wasLastRead !== isLastRead) return false;
  
  // Translation state changes
  const prevTranslation = prevProps.translatedMessages[message.id];
  const nextTranslation = nextProps.translatedMessages[message.id];
  if (prevTranslation?.isVisible !== nextTranslation?.isVisible) return false;
  if (prevTranslation?.text !== nextTranslation?.text) return false;
  
  // Translation in progress indicator
  if (prevProps.translatingMessageId !== nextProps.translatingMessageId) {
    // Only re-render if this message is involved in the translation state change
    if (prevProps.translatingMessageId === message.id || 
        nextProps.translatingMessageId === message.id) {
      return false;
    }
  }
  
  // Language detection state (for showing translate button)
  if (prevProps.messageLanguages[message.id] !== nextProps.messageLanguages[message.id]) {
    return false;
  }
  
  // Online state (affects translate button visibility)
  if (prevProps.isOnline !== nextProps.isOnline) return false;
  
  // User preferred language (affects translate button visibility)
  if (prevProps.userPreferredLanguage !== nextProps.userPreferredLanguage) return false;
  
  // Participant changes (affects sender name and read receipts in group chats)
  if (prevProps.conversationType === 'group') {
    // In group chats, participantMap changes can affect read receipt display
    // Check if any participant info changed for participants who have read this message
    const readByUsers = nextMessage.readBy || [];
    for (const uid of readByUsers) {
      const prevParticipant = prevProps.participantMap[uid];
      const nextParticipant = nextProps.participantMap[uid];
      if (prevParticipant?.displayName !== nextParticipant?.displayName) {
        return false;
      }
    }
  }
  
  // Check sender name change
  const prevSenderName = prevProps.participantMap[message.senderId]?.displayName;
  const nextSenderName = nextProps.participantMap[message.senderId]?.displayName;
  if (prevSenderName !== nextSenderName) return false;
  
  // All props are equal, skip re-render
  return true;
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;

