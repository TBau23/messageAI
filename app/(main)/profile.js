import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { format } from 'date-fns';
import Avatar from '../../components/Avatar';
import { pickImageFromLibrary, uploadProfilePhoto } from '../../utils/imageUtils';
import { database } from '../../utils/database';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  
  // Language preferences
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [isEditingLanguage, setIsEditingLanguage] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const handleBack = () => {
    router.push('/');
  };

  // Load user settings on mount
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const getUserSettings = httpsCallable(functions, 'getUserSettings');
        const result = await getUserSettings();
        
        if (result.data.success && result.data.settings) {
          setPreferredLanguage(result.data.settings.defaultLanguage || 'en');
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
        // Fail silently, use default 'en'
      } finally {
        setIsLoadingSettings(false);
      }
    };

    if (user?.uid) {
      loadUserSettings();
    }
  }, [user?.uid]);

  const handleSaveLanguage = async (languageCode) => {
    try {
      setIsSavingLanguage(true);
      
      const updateUserSettings = httpsCallable(functions, 'updateUserSettings');
      const result = await updateUserSettings({ 
        defaultLanguage: languageCode 
      });

      if (result.data.success) {
        setPreferredLanguage(languageCode);
        setIsEditingLanguage(false);
        Alert.alert('Success', 'Preferred language updated!');
      }
    } catch (error) {
      console.error('Error updating language:', error);
      Alert.alert('Error', 'Failed to update language: ' + error.message);
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleTestAI = async () => {
    try {
      setIsTestingAI(true);
      console.log('🧪 Testing Translation & Cache...');
      
      const translateText = httpsCallable(functions, 'translateText');
      
      // First call - should hit OpenAI
      console.log('📞 First call (uncached)...');
      const result1 = await translateText({
        text: 'Hello, how are you today?',
        targetLanguage: 'es',
        formality: 'neutral'
      });
      console.log('✅ First call:', result1.data.metadata.responseTime + 'ms', 
                  'Cached:', result1.data.cached);
      
      // Second call - should hit cache
      console.log('📞 Second call (should be cached)...');
      const result2 = await translateText({
        text: 'Hello, how are you today?',
        targetLanguage: 'es',
        formality: 'neutral'
      });
      console.log('✅ Second call:', result2.data.metadata.responseTime + 'ms',
                  'Cached:', result2.data.cached);
      
      Alert.alert(
        '✅ Translation & Cache Test!',
        `Original: "Hello, how are you today?"\n` +
        `Translation: "${result1.data.translatedText}"\n\n` +
        `First call: ${result1.data.metadata.responseTime}ms (uncached)\n` +
        `Second call: ${result2.data.metadata.responseTime}ms (${result2.data.cached ? 'CACHED ⚡' : 'not cached'})\n\n` +
        `Speedup: ${(result1.data.metadata.responseTime / result2.data.metadata.responseTime).toFixed(1)}x faster\n` +
        `Quota remaining: ${result2.data.quotaRemaining}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Test Failed:', error);
      Alert.alert(
        '❌ Test Failed',
        `Error: ${error.message}\n\nCheck console logs for details.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will delete all locally cached data. Messages will be reloaded from Firestore.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.clearAllCache();
              Alert.alert('Success', 'Cache cleared successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    if (displayName === user?.displayName) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsSaving(true);

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
      });

      // Force re-fetch user data to update local state
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        useAuthStore.setState({
          user: {
            uid: user.uid,
            email: user.email,
            ...userDoc.data(),
          }
        });
      }

      Alert.alert('Success', 'Display name updated!');
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    try {
      setIsUploadingPhoto(true);

      // Pick image from library
      const image = await pickImageFromLibrary();
      if (!image) {
        setIsUploadingPhoto(false);
        return; // User cancelled
      }

      // Upload to Firebase Storage
      const downloadURL = await uploadProfilePhoto(image.uri, user.uid);

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: downloadURL,
        photoUpdatedAt: new Date(),
      });

      // Force re-fetch user data to update local state
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        useAuthStore.setState({
          user: {
            uid: user.uid,
            email: user.email,
            ...userDoc.data(),
          }
        });
      }

      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      Alert.alert('Error', 'Failed to upload photo: ' + error.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const formatMemberSince = () => {
    if (!user?.createdAt) return 'Unknown';
    try {
      const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return format(date, 'MMMM d, yyyy');
    } catch {
      return 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <Avatar
            photoURL={user?.photoURL}
            displayName={user?.displayName}
            userId={user?.uid}
            size={120}
          />
          
          {isUploadingPhoto && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#075E54" />
            </View>
          )}

          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={handleChangePhoto}
            disabled={isUploadingPhoto}
          >
            <Text style={styles.changePhotoText}>
              {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Display Name Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>
          {isEditingName ? (
            <View style={styles.editingContainer}>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
                autoFocus
                editable={!isSaving}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setDisplayName(user?.displayName || '');
                    setIsEditingName(false);
                  }}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSaveDisplayName}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.valueContainer}
              onPress={() => setIsEditingName(true)}
            >
              <Text style={styles.value}>{user?.displayName || 'Not set'}</Text>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Email Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>

        {/* Member Since Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Member Since</Text>
          <Text style={styles.value}>{formatMemberSince()}</Text>
        </View>

        {/* Preferred Language Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Preferred Language</Text>
          <Text style={styles.sectionDescription}>
            Used for automatic message translation detection
          </Text>
          
          {isEditingLanguage ? (
            <View style={styles.languageSelector}>
              {[
                { code: 'en', name: 'English', flag: '🇬🇧' },
                { code: 'es', name: 'Spanish', flag: '🇪🇸' },
                { code: 'fr', name: 'French', flag: '🇫🇷' },
                { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
                { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
                { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    preferredLanguage === lang.code && styles.languageOptionSelected
                  ]}
                  onPress={() => handleSaveLanguage(lang.code)}
                  disabled={isSavingLanguage}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <Text style={[
                    styles.languageName,
                    preferredLanguage === lang.code && styles.languageNameSelected
                  ]}>
                    {lang.name}
                  </Text>
                  {preferredLanguage === lang.code && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditingLanguage(false)}
                disabled={isSavingLanguage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.valueContainer}
              onPress={() => setIsEditingLanguage(true)}
            >
              {isLoadingSettings ? (
                <ActivityIndicator size="small" color="#075E54" />
              ) : (
                <>
                  <Text style={styles.value}>
                    {
                      {
                        en: '🇬🇧 English',
                        es: '🇪🇸 Spanish',
                        fr: '🇫🇷 French',
                        zh: '🇨🇳 Chinese',
                        ja: '🇯🇵 Japanese',
                        ar: '🇸🇦 Arabic',
                      }[preferredLanguage] || 'English'
                    }
                  </Text>
                  <Text style={styles.editIcon}>✏️</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* TEST AI BUTTON - Remove after Epic 1 testing */}
          <TouchableOpacity 
            style={[styles.actionButton, styles.testAIButton]} 
            onPress={handleTestAI}
            disabled={isTestingAI}
          >
            <Text style={styles.actionButtonText}>
              {isTestingAI ? '🔄 Testing AI...' : '🧪 Test AI Connection'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleClearCache}>
            <Text style={styles.actionButtonText}>Clear Cache</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.signOutButton]}
            onPress={handleSignOut}
          >
            <Text style={[styles.actionButtonText, styles.signOutButtonText]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: '#075E54',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#075E54',
    borderRadius: 20,
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  value: {
    fontSize: 16,
    color: '#000',
  },
  editIcon: {
    fontSize: 16,
  },
  editingContainer: {
    gap: 10,
  },
  input: {
    fontSize: 16,
    color: '#000',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#075E54',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#075E54',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsSection: {
    marginTop: 20,
    gap: 15,
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  testAIButton: {
    backgroundColor: '#e3f2fd',
  },
  signOutButton: {
    backgroundColor: '#ffebee',
  },
  signOutButtonText: {
    color: '#c62828',
  },
  // Language preference styles
  sectionDescription: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
    lineHeight: 18,
  },
  languageSelector: {
    gap: 10,
    marginTop: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#075E54',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  languageNameSelected: {
    fontWeight: '600',
    color: '#075E54',
  },
  checkmark: {
    fontSize: 18,
    color: '#075E54',
    fontWeight: 'bold',
  },
});

