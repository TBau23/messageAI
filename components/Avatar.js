import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useState } from 'react';

/**
 * Avatar component - displays profile photo or initials
 * @param {Object} props
 * @param {string} props.photoURL - Profile photo URL (optional)
 * @param {string} props.displayName - User's display name
 * @param {number} props.size - Avatar size in pixels (default 50)
 * @param {Function} props.onPress - Optional press handler
 * @param {string} props.userId - User ID for consistent color (optional)
 * @param {Object} props.style - Additional container styles
 */
export default function Avatar({ 
  photoURL, 
  displayName, 
  size = 50, 
  onPress,
  userId,
  style
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Get initials from display name
  const getInitials = () => {
    if (!displayName) return '?';
    const parts = displayName.trim().split(' ');
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Generate consistent background color based on userId or displayName
  const getBackgroundColor = () => {
    const colors = [
      '#075E54', // WhatsApp green
      '#128C7E', // Lighter green
      '#25D366', // WhatsApp teal
      '#34B7F1', // Light blue
      '#7C4DFF', // Purple
      '#FF6F00', // Orange
      '#E91E63', // Pink
      '#00BCD4', // Cyan
    ];
    
    const seed = userId || displayName || '0';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarSize = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const initials = getInitials();
  const backgroundColor = getBackgroundColor();
  const fontSize = size * 0.4; // Font size is 40% of avatar size

  // Show photo if available and not errored
  const showPhoto = photoURL && !imageError;

  const content = (
    <View style={[styles.container, avatarSize, { backgroundColor: showPhoto ? '#e0e0e0' : backgroundColor }, style]}>
      {showPhoto ? (
        <>
          <Image
            source={{ uri: photoURL }}
            style={[styles.image, avatarSize]}
            contentFit="cover"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
          {imageLoading && (
            <View style={[styles.loadingOverlay, avatarSize]}>
              <ActivityIndicator size="small" color="#999" />
            </View>
          )}
        </>
      ) : (
        <Text style={[styles.initials, { fontSize }]}>
          {initials}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

