import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Configure notification behavior
 * This determines how notifications are displayed when app is foregrounded
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get Expo push token
 * @returns {Promise<string|null>} Expo push token or null if failed
 */
export async function registerForPushNotifications() {
  let token = null;

  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Handle permission denied
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get the Expo push token
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('✅ Expo push token obtained:', token);

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#075E54',
        description: 'Notifications for new messages',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send a push notification via Expo Push API
 * @param {string} expoPushToken - Recipient's Expo push token
 * @param {Object} notification - Notification data
 * @param {string} notification.title - Notification title (sender name)
 * @param {string} notification.body - Notification body (message text)
 * @param {Object} notification.data - Additional data (conversationId, etc.)
 * @param {number} notification.badge - Badge count
 * @returns {Promise<boolean>} Success status
 */
export async function sendPushNotification(expoPushToken, notification) {
  if (!expoPushToken) {
    console.log('No push token provided, skipping push notification');
    return false;
  }

  // Validate Expo push token format
  if (!expoPushToken.startsWith('ExponentPushToken[')) {
    console.log('Invalid Expo push token format:', expoPushToken);
    return false;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    badge: notification.badge || 0,
    priority: 'high',
    channelId: 'messages', // Android
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data?.[0]?.status === 'error') {
      console.error('Push notification error:', result.data[0].message);
      return false;
    }

    console.log('✅ Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Update app badge count
 * @param {number} count - Badge number to display
 */
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

/**
 * Clear all delivered notifications
 */
export async function clearAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}

/**
 * Check if device supports push notifications
 * @returns {boolean} True if device is physical device
 */
export function canReceivePushNotifications() {
  return Device.isDevice;
}

