import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

/**
 * Request camera and media library permissions
 * @returns {Promise<boolean>} True if permissions granted
 */
export async function requestImagePermissions() {
  try {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return cameraPermission.status === 'granted' && libraryPermission.status === 'granted';
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}

/**
 * Pick an image from the device's library
 * @returns {Promise<Object|null>} Image data or null if cancelled
 */
export async function pickImageFromLibrary() {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1], // Square for profile photos
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  } catch (error) {
    console.error('Error picking image from library:', error);
    throw error;
  }
}

/**
 * Take a photo with the camera
 * @returns {Promise<Object|null>} Image data or null if cancelled
 */
export async function takePhoto() {
  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  } catch (error) {
    console.error('Error taking photo:', error);
    throw error;
  }
}

/**
 * Pick an image for messaging (allows any aspect ratio)
 * @returns {Promise<Object|null>} Image data or null if cancelled
 */
export async function pickImageForMessage() {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // No cropping for messages
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  } catch (error) {
    console.error('Error picking image for message:', error);
    throw error;
  }
}

/**
 * Compress and resize an image
 * @param {string} uri - Image URI
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} quality - Compression quality (0-1)
 * @returns {Promise<Object>} Compressed image data
 */
export async function compressImage(uri, maxWidth = 1024, quality = 0.8) {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      uri: manipResult.uri,
      width: manipResult.width,
      height: manipResult.height,
    };
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

/**
 * Upload image to Firebase Storage
 * @param {string} uri - Local image URI
 * @param {string} path - Storage path (e.g., 'profile-photos/userId/profile.jpg')
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<string>} Download URL
 */
export async function uploadImage(uri, path, onProgress = null) {
  try {

    // Fetch the image as a blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Create storage reference
    const storageRef = ref(storage, path);

    // Upload the blob
    const snapshot = await uploadBytes(storageRef, blob);
    

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
}

/**
 * Upload profile photo
 * @param {string} uri - Local image URI
 * @param {string} userId - User ID
 * @returns {Promise<string>} Download URL
 */
export async function uploadProfilePhoto(uri, userId) {
  try {
    // Compress image first (profile photos should be small)
    const compressed = await compressImage(uri, 512, 0.8);
    
    // Upload to storage
    const path = `profile-photos/${userId}/profile.jpg`;
    const downloadURL = await uploadImage(compressed.uri, path);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw error;
  }
}

/**
 * Upload group chat photo
 * @param {string} uri - Local image URI
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<string>} Download URL
 */
export async function uploadGroupPhoto(uri, conversationId) {
  try {
    // Compress image
    const compressed = await compressImage(uri, 512, 0.8);
    
    // Upload to storage
    const path = `group-photos/${conversationId}/group.jpg`;
    const downloadURL = await uploadImage(compressed.uri, path);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading group photo:', error);
    throw error;
  }
}

/**
 * Upload message image
 * @param {string} uri - Local image URI
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} { downloadURL, width, height }
 */
export async function uploadMessageImage(uri, conversationId, messageId) {
  try {
    // Compress image (larger than profile, but still reasonable)
    const compressed = await compressImage(uri, 1024, 0.8);
    
    // Upload to storage
    const path = `messages/${conversationId}/${messageId}.jpg`;
    const downloadURL = await uploadImage(compressed.uri, path);
    
    return {
      downloadURL,
      width: compressed.width,
      height: compressed.height,
    };
  } catch (error) {
    console.error('Error uploading message image:', error);
    throw error;
  }
}

/**
 * Show action sheet to pick image source (camera or library)
 * @returns {Promise<Object|null>} Image data or null if cancelled
 */
export async function showImagePickerOptions() {
  // Note: For a proper action sheet, you might want to use
  // @react-native-actionsheet or a custom modal
  // For now, just return library picker
  return await pickImageFromLibrary();
}

