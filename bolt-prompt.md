# XRPChat App Prompt for Bolt

Create a secure, end-to-end encrypted messaging app called XRPChat with the following specifications:

## Core Functionality

Build a cross-platform mobile messaging application that allows users to communicate securely using wallet-based identities with the following key features:

### Authentication & Identity
- Email/password authentication system powered by Supabase
- Username creation during signup
- XRP wallet generation for each user (using XRPL.js)
- Secure private key storage with biometric protection option
- Email verification flow with deep linking

### Messaging
- End-to-end encrypted messaging using NaCl/TweetNaCl
- Real-time message delivery via Supabase Realtime
- Thread-based conversations (1:1 chats)
- Message search functionality
- Auto-delete messages with configurable timeframes (1hr, 24hrs, 7 days, 30 days, custom)
- Read receipts and typing indicators
- Offline message queuing

### Contacts
- Contact management system
- Add contacts via wallet address or username search
- QR code scanning for adding contacts (using Expo Camera/BarCode Scanner)
- Generate and share QR code containing wallet address and username
- Block/unblock contacts functionality

### User Experience
- Bottom tab navigation (Chats, Contacts, Profile, Settings)
- Dark/light mode with system preference option
- Modern, clean UI with focus on privacy/security
- Pull-to-refresh for content updates
- Swipe gestures for common actions

### Security
- Full end-to-end encryption for all messages
- Message expiration and auto-deletion
- Biometric authentication for accessing keys
- Private key protection and secure storage
- Screenshot prevention on sensitive screens
- No unencrypted message storage

## Technical Requirements

### Frontend
- Build with Expo/React Native
- Use React Navigation for app navigation
- Implement responsive layouts for various device sizes
- Use NativeWind or React Native StyleSheet for styling
- Implement Expo Vector Icons for UI elements

### Backend
- Use Supabase for auth, database, and storage
- Set up Supabase Realtime for message subscriptions
- Implement Supabase RLS policies for security
- Use Supabase Storage for media uploads

### Data Model
- Profiles: id, username, avatar_url, wallet_address, updated_at, last_active
- Wallets: id, profile_id, address, public_key, private_key, created_at, updated_at
- Threads: id, created_at, updated_at, name, participant_ids, last_message_at, created_by
- Messages: id, created_at, thread_id, sender_id, content, read
- Device tokens: id, user_id, token, platform, created_at

### Dependencies
- @supabase/supabase-js - Backend and auth
- expo-secure-store - For key storage
- tweetnacl - For encryption
- base64-arraybuffer - For encoding/decoding
- expo-barcode-scanner - For QR code scanning
- react-native-qrcode-svg - For QR code generation
- xrpl - For XRP wallet operations
- expo-notifications - For push notifications
- @react-native-async-storage/async-storage - For local storage
- expo-local-authentication - For biometrics
- expo-screen-capture - For screenshot prevention

## Key Screens

1. **Onboarding**
   - Welcome screen with app introduction
   - Sign up form (email, password, username)
   - Sign in form
   - Private key backup screen
   - Email verification screen
   - Password reset flow

2. **Chat List**
   - List of conversations with last message preview
   - Unread message indicators
   - Search functionality
   - New chat button
   - Message timestamps
   - Delete thread functionality

3. **Chat Detail**
   - Message thread with bubbles (sent/received)
   - Input field with send button
   - Encrypted message indicators
   - Auto-delete countdown indicators
   - Typing indicators
   - Timestamp displays
   - Read receipts

4. **Contacts**
   - Contact list with online status indicators
   - Add contact button (manual/QR code)
   - Block/unblock functionality
   - Contact details screen
   - My QR code for sharing

5. **Profile**
   - User profile with avatar
   - Username display and edit
   - Wallet address display
   - Public key display
   - Private key access (with biometric verification)
   - Wallet regeneration option

6. **Settings**
   - Auto-delete configuration
   - Notification preferences
   - Theme selection
   - Encryption settings
   - Security options
   - App information

## Security Implementation

- Implement proper key derivation and storage
- Ensure messages are encrypted before storage
- Set up secure key backup mechanism
- Implement biometric protection for key access
- Create auto-delete background process
- Ensure keys never leave the device unencrypted

## UX Guidelines

- Prioritize privacy and security in design
- Create intuitive navigation patterns
- Use clear indicators for encryption/security status
- Provide user feedback for all security operations
- Design for one-handed mobile usage
- Implement proper keyboard handling
- Use loading states and error handling throughout

Build this app optimized for both iOS and Android platforms, with a focus on security, privacy, and seamless user experience. The app should replicate the core functionality of the web version at https://xrpchat.app/ but be rebuilt natively for mobile using React Native best practices. 