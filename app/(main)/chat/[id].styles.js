import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#075E54',
  },
  container: {
    flex: 1,
    backgroundColor: '#e5ddd5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    padding: 10,
    paddingTop: 10,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  backText: {
    color: '#fff',
    fontSize: 24,
  },
  headerAvatar: {
    marginRight: 10,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineStatus: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  offlineStatus: {
    color: '#999',
  },
  typingStatus: {
    color: '#c8e6ff',
  },
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    marginBottom: 10,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 8,
  },
  myMessageBubble: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
  },
  failedMessageBubble: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#075E54',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#000',
  },
  failedMessageText: {
    color: '#b71c1c',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  myMessageTime: {
    color: '#666',
  },
  otherMessageTime: {
    color: '#999',
  },
  messageStatus: {
    fontSize: 12,
    color: '#666',
  },
  failedMessageStatus: {
    fontWeight: 'bold',
  },
  imagePreview: {
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  removeImage: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  imageButton: {
    padding: 10,
    marginRight: 5,
  },
  imageButtonText: {
    fontSize: 24,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#075E54',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8b5b1',
  },
  retryButtonText: {
    color: '#8b0000',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#075E54',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  memberList: {
    paddingHorizontal: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#4caf50',
  },
  statusDotOffline: {
    backgroundColor: '#999',
  },
  memberStatus: {
    fontSize: 13,
    color: '#666',
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
  },
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#075E54',
  },
  statusModalClose: {
    fontSize: 22,
    color: '#666',
    fontWeight: 'bold',
  },
  statusModalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statusModalMessageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  statusModalTimestamp: {
    fontSize: 12,
    color: '#777',
    marginBottom: 16,
  },
  statusModalListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusModalListHeaderText: {
    color: '#607D8B',
    fontSize: 12,
    fontWeight: '700',
  },
  statusModalListHeaderParticipant: {
    flex: 1.4,
  },
  statusModalListHeaderRead: {
    flex: 1,
    textAlign: 'right',
  },
  statusModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f4',
  },
  statusModalParticipant: {
    color: '#37474F',
    fontSize: 14,
    fontWeight: '600',
  },
  statusModalParticipantCell: {
    flex: 1.4,
  },
  statusModalRead: {
    flex: 1,
    color: '#2E7D32',
    fontSize: 12,
    textAlign: 'right',
  },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    marginTop: 10,
    marginHorizontal: 20,
  },
  saveGroupNameButton: {
    backgroundColor: '#075E54',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  saveGroupNameButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editGroupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editGroupModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  editGroupModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  // Translation UI styles
  translationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  translationButtonActive: {
    backgroundColor: '#075E54',
  },
  translationButtonDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.5,
  },
  translationButtonText: {
    fontSize: 20,
  },
  translationButtonTextDisabled: {
    opacity: 0.5,
  },
  translationSettingsModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  translationSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  translationSettingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  translationToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    padding: 2,
    justifyContent: 'center',
  },
  translationToggleActive: {
    backgroundColor: '#075E54',
  },
  translationToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  translationToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  translationSettingSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  translationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languageOption: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  languageOptionSelected: {
    borderColor: '#075E54',
    borderWidth: 2,
    backgroundColor: '#E8F5E9',
  },
  languageFlag: {
    fontSize: 24,
    marginBottom: 4,
  },
  languageName: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  languageNameSelected: {
    fontWeight: 'bold',
    color: '#075E54',
  },
  formalityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formalityOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  formalityOptionSelected: {
    borderColor: '#075E54',
    borderWidth: 2,
    backgroundColor: '#E8F5E9',
  },
  formalityIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  formalityLabel: {
    fontSize: 13,
    color: '#333',
  },
  formalityLabelSelected: {
    fontWeight: 'bold',
    color: '#075E54',
  },
  translationSettingsCloseButton: {
    backgroundColor: '#075E54',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  translationSettingsCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Translation Preview styles
  inputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  translationPreviewContainer: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#075E54',
  },
  translationPreviewLoading: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  translationPreviewContent: {
    gap: 2,
  },
  translationPreviewLabel: {
    fontSize: 11,
    color: '#075E54',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  translationPreviewText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  translationPreviewError: {
    fontSize: 13,
    color: '#d32f2f',
    fontStyle: 'italic',
  },
  // Translate button for received messages
  translateButton: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#075E54',
    alignSelf: 'flex-start',
  },
  translateButtonActive: {
    backgroundColor: '#075E54',
  },
  translateButtonText: {
    color: '#075E54',
    fontSize: 12,
    fontWeight: '600',
  },
  translateButtonTextActive: {
    color: '#fff',
  },
  // Translated text styles
  originalTextDimmed: {
    opacity: 0.6,
  },
  translatedTextContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  translatedTextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#075E54',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  translatedText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  // Explanation Modal styles
  explanationModal: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  explanationLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationLoadingText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  explanationContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexGrow: 1,
  },
  explanationOriginalMessage: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#075E54',
  },
  explanationOriginalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  explanationOriginalText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 6,
  },
  explanationLanguageLabel: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  explanationTextContainer: {
    paddingVertical: 8,
  },
  explanationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
    marginBottom: 12,
  },
  explanationCacheNote: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  explanationNoContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  explanationNoContentText: {
    fontSize: 15,
    color: '#4caf50',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  explanationNoContentSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  explanationDismissButton: {
    backgroundColor: '#075E54',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  explanationDismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

