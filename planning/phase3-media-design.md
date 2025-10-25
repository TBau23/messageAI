# Phase 3: Media Support & Profile Photos - Technical Design

**Goal:** Achieve "Excellent" scores for Performance & UX (12/12) + Auth & Data Management (5/5)

**Rubric Requirements:**
- Progressive image loading with placeholders ⬜
- Profile photos working ⬜
- User profiles implemented correctly ⬜
- Professional layout and transitions ⬜

---

## Current State

### ✅ What Exists
- User authentication with Firestore user documents
- Display names stored and shown in chats
- Initials fallback for avatars (hardcoded colors)
- Profile setup screen (basic, text only)

### ⬜ What's Missing
- Firebase Storage integration
- Image upload/download
- Profile photo management
- Image messaging
- Group chat photos (custom or composite)
- Group name editing
- Media gallery
- Profile page

---

## Architecture Overview

### Firebase Storage Structure
```
gs://bucket/
├── profile-photos/
│   └── {userId}/
│       └── profile.jpg
├── group-photos/
│   └── {conversationId}/
│       └── group.jpg
└── messages/
    └── {conversationId}/
        └── {messageId}.jpg
```

### Firestore Schema Updates
```javascript
users/{uid}
  ├─ displayName: string
  ├─ email: string
  ├─ photoURL: string?          // NEW: Profile photo URL
  ├─ photoUpdatedAt: timestamp? // NEW: Track updates
  └─ ...existing fields

conversations/{conversationId}
  ├─ type: "direct" | "group"
  ├─ name: string?
  ├─ customPhotoURL: string?    // NEW: Custom group photo
  ├─ photoUpdatedAt: timestamp? // NEW: Track updates
  └─ ...existing fields

messages/{messageId}
  ├─ text: string?
  ├─ imageURL: string?          // NEW: Message image
  ├─ imageWidth: number?        // NEW: Aspect ratio
  ├─ imageHeight: number?       // NEW: Aspect ratio
  └─ ...existing fields
```

---

## Implementation Plan

### 1. Firebase Storage Setup

**File:** `firebaseConfig.js` (modify)

**Changes:**
```javascript
import { getStorage } from 'firebase/storage';

export const storage = getStorage(app);
```

**Dependencies:** None (Firebase Storage included in firebase package)

---

### 2. Image Utilities

**File:** `utils/imageUtils.js` (new)

**Responsibilities:**
- Pick image from camera/library
- Compress/resize images
- Upload to Firebase Storage
- Generate thumbnails
- Get download URLs

**Key Functions:**
```javascript
pickImage(options)
  - Use expo-image-picker
  - Returns { uri, width, height }

compressImage(uri, maxWidth)
  - Use expo-image-manipulator
  - Reduce file size for uploads
  - Returns compressed URI

uploadImage(uri, path)
  - Upload to Firebase Storage at path
  - Show progress (optional)
  - Returns download URL

generateThumbnail(uri, size)
  - Create small thumbnail for lists
  - Returns thumbnail URI
```

**New Dependencies:**
- `expo-image-picker` - Pick from camera/library
- `expo-image-manipulator` - Resize/compress

---

### 3. Profile Page

**File:** `app/(main)/profile.js` (new)

**Layout:**
```
┌──────────────────────┐
│ ← Profile            │
├──────────────────────┤
│                      │
│   [Profile Photo]    │ 150x150, circular
│    Change Photo      │ Button
│                      │
├──────────────────────┤
│ Display Name         │
│ [John Doe       ✏️]  │ Tap to edit
│                      │
│ Email                │
│ john@example.com     │ Read-only
│                      │
│ Member Since         │
│ October 15, 2025     │ Read-only
│                      │
├──────────────────────┤
│  [Clear Cache]       │
│  [Sign Out]          │ Red/destructive
└──────────────────────┘
```

**Features:**
- Tap photo → Image picker → Upload → Update Firestore
- Tap display name → Modal/inline edit → Update
- Member since from `users.createdAt`
- Sign out → Clear tokens → Navigate to login

**Navigation:** Add "Profile" to chat list menu (⋮)

---

### 4. Profile Photo Display

**Files to Modify:**
- `app/(main)/index.js` - Chat list avatars
- `app/(main)/chat/[id].js` - Chat header avatar
- `app/(auth)/profile-setup.js` - Add photo during signup (optional)

**Component:** `components/Avatar.js` (new)

**Props:**
```javascript
<Avatar
  photoURL={user.photoURL}
  displayName={user.displayName}
  size={50}
  onPress={() => {}} // Optional
/>
```

**Behavior:**
- If photoURL → Load from Firebase Storage with caching
- Else → Show initials with background color
- Loading → Show skeleton/spinner
- Error → Fallback to initials

---

### 5. Group Chat Photos

**File:** `components/GroupAvatar.js` (new)

**Two Modes:**

**Mode A: Custom Photo Set**
- Admin/creator uploads custom group photo
- Stored in `conversations.customPhotoURL`
- Displayed like profile photo

**Mode B: Composite (iOS-style)**
- No custom photo set
- Show composite of first 4 participants
- Layout:
  - 1 person: Full circle (profile photo or initial)
  - 2 people: Split circle (left/right)
  - 3 people: Split circle (left, top-right, bottom-right)
  - 4+ people: Quad circle (2x2 grid)

**Implementation:**
```javascript
<GroupAvatar
  conversationId={id}
  customPhotoURL={convo.customPhotoURL}
  participants={convo.participantDetails}
  size={50}
/>
```

**Logic:**
1. Check if customPhotoURL exists → Show that
2. Else → Generate composite from participants array
3. Load each participant's photoURL or use initials
4. Position in grid based on count

---

### 6. Group Name & Photo Editing

**File:** `app/(main)/chat/[id].js` (modify)

**Add to Header:**
- Tap group name/photo → Opens edit modal

**Modal UI:**
```
┌─────────────────────┐
│ Edit Group          │
├─────────────────────┤
│                     │
│  [Group Photo]      │ Tap to change
│   Change Photo      │
│                     │
│ Group Name          │
│ [Family Chat   ✏️]  │
│                     │
│  [Save]  [Cancel]   │
└─────────────────────┘
```

**Features:**
- Change photo → Upload to Storage → Update `customPhotoURL`
- Edit name → Update `conversations.name`
- Only participants can edit (check auth)

**Firestore Update:**
```javascript
updateDoc(conversationDoc, {
  name: newName,
  customPhotoURL: newPhotoURL,
  updatedAt: serverTimestamp()
});
```

---

### 7. Image Messaging

**File:** `app/(main)/chat/[id].js` (modify)

**Add Image Button to Input:**
```
┌─────────────────────────┐
│ [📷] [Type message...] [Send] │
└─────────────────────────┘
```

**Flow:**
1. Tap 📷 → Image picker (camera or library)
2. User selects image
3. Show preview with "Send" button
4. Compress image (max 1024px width)
5. Upload to `messages/{conversationId}/{messageId}.jpg`
6. Create message with `imageURL`
7. Display in chat with progressive loading

**Message Rendering:**
```javascript
renderMessage(message) {
  if (message.imageURL) {
    return (
      <TouchableOpacity onPress={() => openImageViewer(message.imageURL)}>
        <Image
          source={{ uri: message.imageURL }}
          style={{ width: 200, height: 200 * aspectRatio }}
          placeholder={<Skeleton />}
        />
      </TouchableOpacity>
    );
  }
  // Regular text message
}
```

---

### 8. Image Viewer (Full Screen)

**File:** `components/ImageViewer.js` (new)

**Features:**
- Full-screen modal
- Pinch to zoom
- Swipe to dismiss
- Download/share button (optional)

**Usage:**
```javascript
<ImageViewer
  visible={showViewer}
  imageURL={selectedImageURL}
  onClose={() => setShowViewer(false)}
/>
```

**Libraries:**
- `react-native-image-zoom-viewer` OR
- Build custom with `react-native-gesture-handler`

---

### 9. Media Gallery

**File:** `app/(main)/chat/[id].js` (add tab/section)

**Access:** Tap "View Media" button in chat header menu

**UI:**
```
┌─────────────────────┐
│ ← Media (12)        │
├─────────────────────┤
│ [img] [img] [img]   │ Grid layout
│ [img] [img] [img]   │ 3 columns
│ [img] [img] [img]   │
└─────────────────────┘
```

**Features:**
- Query messages where `imageURL` exists
- Display in grid (FlatList with numColumns={3})
- Tap → Open image viewer
- Load recent first (timestamp DESC)
- Pagination (load 30 at a time)

---

## Performance Optimizations

### Image Caching
- Use `expo-image` (drop-in replacement for `<Image>`)
- Automatic disk caching
- Better performance than default Image component

### Progressive Loading
```javascript
<Image
  source={{ uri: imageURL }}
  placeholder={blurhash} // or skeleton
  transition={200} // fade in
/>
```

### Thumbnail Generation
- Store thumbnail URLs separately (optional)
- Use smaller images for lists
- Full-size only in detail views

### Compression Before Upload
```javascript
compressImage(uri, {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8, // 80% quality
  format: 'jpeg'
});
```

**Result:** ~200KB per image instead of 2-5MB

---

## File Changes Summary

### New Files (7)
1. `utils/imageUtils.js` (~150 lines) - Image upload/compression
2. `app/(main)/profile.js` (~200 lines) - Profile page
3. `components/Avatar.js` (~80 lines) - Profile photo component
4. `components/GroupAvatar.js` (~120 lines) - Group composite photo
5. `components/ImageViewer.js` (~100 lines) - Full-screen viewer
6. `components/ImagePicker.js` (~80 lines) - Image selection helper
7. `app/(main)/media/[id].js` (~150 lines) - Media gallery (optional)

### Modified Files (5)
1. `firebaseConfig.js` (+5 lines) - Add Storage export
2. `app/(main)/index.js` (+20 lines) - Use Avatar component
3. `app/(main)/chat/[id].js` (+100 lines) - Image messages, group editing
4. `store/authStore.js` (+30 lines) - Photo upload functions
5. `store/chatStore.js` (+40 lines) - Image message handling

**Total New Code:** ~880 lines

---

## New Dependencies

```json
{
  "expo-image-picker": "~16.0.7",
  "expo-image-manipulator": "~13.0.8",
  "expo-image": "~2.0.3"
}
```

Install:
```bash
npx expo install expo-image-picker expo-image-manipulator expo-image
```

**Permissions needed (app.json):**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow access to your photos to send images",
          "cameraPermission": "Allow access to camera to take photos"
        }
      ]
    ]
  }
}
```

---

## Testing Strategy

### Manual Tests

**Test 1: Profile Photo Upload**
1. Open profile page
2. Tap "Change Photo"
3. Select from library
4. Photo uploads and displays
5. Check Firestore: `users/{uid}.photoURL` updated
6. Check Storage: File exists at `profile-photos/{uid}/profile.jpg`

**Test 2: Profile Photo Display**
1. Upload profile photo
2. Return to chat list
3. Profile photo appears in conversations
4. Open chat → Photo in header
5. Other users see updated photo

**Test 3: Group Photo Composite**
1. Create group chat with 3 people
2. No custom photo set
3. Composite shows 3 initials/photos in split circle
4. Upload custom group photo
5. Composite replaced by custom photo

**Test 4: Image Messaging**
1. Tap 📷 button
2. Select/take photo
3. Image compresses and uploads
4. Message appears with image
5. Tap image → Opens full-screen viewer
6. Recipient sees image immediately

**Test 5: Group Name Edit**
1. Open group chat
2. Tap group name in header
3. Edit modal opens
4. Change name
5. All participants see updated name

---

## Error Handling

### Upload Failures
- Network error → Retry button
- Permission denied → Show settings prompt
- File too large → Auto-compress more aggressively
- Storage quota → Show error message

### Image Loading Failures
- 404 Not Found → Fallback to initials
- Slow network → Show skeleton/spinner
- Corrupt image → Show error icon

### Permission Denied
- Camera access → Show prompt to enable in Settings
- Photos access → Show prompt to enable in Settings
- Graceful fallback: User can't upload but app still works

---

## Security Considerations

### Firebase Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile photos
    match /profile-photos/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024; // 5MB limit
    }
    
    // Group photos
    match /group-photos/{conversationId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024;
      // TODO: Check if user is participant in conversation
    }
    
    // Message images
    match /messages/{conversationId}/{messageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024; // 10MB limit
      // TODO: Check if user is participant in conversation
    }
  }
}
```

---

## Implementation Order

1. ✅ Install dependencies
2. ✅ Setup Firebase Storage in firebaseConfig
3. ✅ Create imageUtils.js (upload/compress functions)
4. ✅ Create Avatar component (profile photos)
5. ✅ Create Profile page with photo upload
6. ✅ Update chat list to show profile photos
7. ✅ Update chat header to show profile photos
8. ✅ Add image messaging to chat screen
9. ✅ Create ImageViewer component
10. ✅ Create GroupAvatar with composite logic
11. ✅ Add group name/photo editing
12. ✅ Create media gallery (optional)
13. ✅ Deploy Storage security rules

**Estimated Time:** 8-10 hours

---

## Success Criteria

### Rubric Alignment

**Performance & UX (12/12 points):**
- [ ] Images load progressively with placeholders ✅
- [ ] Professional layout (profile page, image viewer) ✅
- [ ] Smooth 60 FPS scrolling (even with images) ✅
- [ ] Optimistic UI (images appear instantly) ✅

**Auth & Data Management (5/5 points):**
- [ ] User profiles with photos working ✅
- [ ] Proper session handling (existing) ✅
- [ ] Secure user management (Storage rules) ✅

**Target Score:** 17/17 points (Excellent)

---

## Notes

- **iOS-style composite photos:** Complex but adds polish (+bonus points)
- **Image compression critical:** Reduces bandwidth and storage costs
- **Progressive loading:** Improves perceived performance
- **Security rules:** Must deploy before sharing with others
- **expo-image vs Image:** Use expo-image for better performance

**Total Points at Stake:** 17 base points + potential bonus for polish

