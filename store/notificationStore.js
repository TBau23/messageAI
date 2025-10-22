import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notification: null,
  currentChatId: null, // Track which chat is currently open

  // Set the currently open chat (to prevent notifications from that chat)
  setCurrentChatId: (chatId) => {
    set({ currentChatId: chatId });
  },

  // Show a notification
  showNotification: (message) => {
    const { currentChatId } = get();
    
    // Don't show notification if the message is from the currently open chat
    if (message.conversationId === currentChatId) {
      return;
    }

    set({ notification: message });
  },

  // Clear the notification
  clearNotification: () => {
    set({ notification: null });
  },
}));

