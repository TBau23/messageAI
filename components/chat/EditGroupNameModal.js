import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';

/**
 * Modal component for editing group chat name
 */
export default function EditGroupNameModal({ 
  visible, 
  onClose, 
  groupName,
  onChangeText,
  onSave,
  styles 
}) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.editGroupModalOverlay}
      >
        <TouchableOpacity 
          style={styles.editGroupModalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.editGroupModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Group Name</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={onChangeText}
            placeholder="Group name"
            autoFocus
            maxLength={50}
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          
          <TouchableOpacity
            style={styles.saveGroupNameButton}
            onPress={onSave}
          >
            <Text style={styles.saveGroupNameButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

