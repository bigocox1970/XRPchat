# XRPChat Expo Migration Guide

## Migration Strategy Overview

The migration of XRPChat from a web-based React application to a cross-platform Expo app requires careful planning and adaptation of existing components. This document outlines a step-by-step approach to rebuild the application in Bolt.new or Bolt.diy.

## Expo Adaptation Considerations

### Core Technology Changes

| Web Application | Expo Equivalent |
|-----------------|-----------------|
| React DOM | React Native |
| TailwindCSS | NativeWind or React Native styling |
| Browser Storage | AsyncStorage |
| Browser Notifications | Expo Notifications |
| React Router DOM | React Navigation |
| HTML5 QR Code | Expo Camera/Expo BarCode Scanner |

### Supabase Integration

Supabase works well with Expo applications and most of the database logic can be reused with minimal changes:

1. Use `@supabase/supabase-js` with React Native
2. Update client configuration for mobile environments
3. Handle auth flows using Supabase Auth with deep linking

### UI Component Adaptation

Each component must be rewritten using React Native equivalents:

- Replace `<div>` with `<View>`
- Replace `<button>` with `<TouchableOpacity>` or `<Button>`  
- Replace `<input>` with `<TextInput>`
- Replace forms with React Native form components
- Replace CSS/Tailwind with StyleSheet or NativeWind

## Migration Roadmap

### Phase 1: Project Setup

1. Initialize a new Expo project in Bolt.new or Bolt.diy
2. Configure Supabase integration
3. Set up AsyncStorage for local storage
4. Configure environment variables

### Phase 2: Authentication System

1. Implement UserContext with Supabase Auth
2. Create Login/Register screens
3. Implement secure storage for sensitive data
4. Set up deep linking for auth flows

### Phase 3: Core App Structure

1. Implement navigation using React Navigation
   - Tab navigation for main sections (Chats, Contacts, Profile, Settings)
   - Stack navigation for screen hierarchies
2. Create screens for each main page
3. Implement the theme system (dark/light mode)

### Phase 4: Messaging System

1. Implement encryption utilities
2. Build chat list and chat detail screens
3. Implement real-time message delivery with Supabase subscriptions
4. Add auto-delete functionality

### Phase 5: Contact Management

1. Build contact list screen
2. Implement QR code scanning and generation
3. Add contact management features (add, block, etc.)

### Phase 6: Settings and Profile

1. Create settings screens
2. Implement notification system with Expo Notifications
3. Build profile management screen
4. Add wallet management features

### Phase 7: Testing and Polish

1. Cross-platform testing
2. Performance optimization
3. Bug fixes and UI polish

## Bolt.new Prompt

```
Create a secure, end-to-end encrypted messaging app called XRPChat with the following features:

1. AUTHENTICATION:
- Email/password authentication with Supabase
- Username creation during signup
- XRP wallet generation for each user
- Secure private key storage

2. USER INTERFACE:
- Bottom tab navigation with: Chats, Contacts, Profile, Settings
- Dark/light mode support
- Clean, modern UI with a focus on privacy

3. MESSAGING:
- End-to-end encrypted messaging using user keys
- Real-time message delivery with Supabase
- Message list with search functionality
- Thread-based conversations
- Auto-delete messages feature with configurable timeframes
- Read receipts
- Typing indicators

4. CONTACTS:
- Contact list management
- Add contacts via wallet address or username
- QR code scanning for adding contacts
- Contact sharing via QR code
- Block/unblock contacts

5. PROFILE & SETTINGS:
- Profile management (username, avatar)
- Wallet management (address, public key, private key)
- Notification settings
- Auto-delete configuration
- Theme settings (dark/light/system)

6. SECURITY:
- End-to-end encryption for all messages
- Message expiration functionality
- Private key protection
- No message storage outside of encrypted database

7. TECHNICAL REQUIREMENTS:
- Build with Expo/React Native
- Use Supabase for backend (auth, database, storage)
- Implement XRPL.js for wallet operations
- Use AsyncStorage for secure local storage
- Implement Expo Notifications for push notifications
- Use React Navigation for app navigation

The app should mimic the web application at https://xrpchat.app/ but be optimized for mobile using React Native best practices.
```

## Key Considerations for Expo

### Native Module Replacements

| Web Module | Expo/React Native Replacement |
|------------|--------------------------------|
| `html5-qrcode` | `expo-barcode-scanner` |
| `qrcode.react` | `react-native-qrcode-svg` |
| `localStorage` | `@react-native-async-storage/async-storage` |
| Browser Notifications | `expo-notifications` |
| `react-icons` | `@expo/vector-icons` |

### Authentication Adaptation

1. Replace browser-based auth flow with mobile-optimized flow
2. Use deep linking for email confirmation
3. Handle app state changes properly

### Encryption Considerations

1. Ensure cryptographic libraries work in React Native environment
2. Test encryption/decryption performance on mobile devices
3. Use secure storage for keys

### UI/UX Adaptation

1. Design for touch interfaces rather than mouse/keyboard
2. Consider screen size variations
3. Implement proper keyboard handling
4. Add pull-to-refresh and other mobile-specific interactions

## Supabase Configuration for Expo

### Setup

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabase };
```

### Authentication

```typescript
// Sign up
const signUp = async (email, password, username) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });
  // Handle profile and wallet creation
};

// Sign in
const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  // Handle result
};
```

## Component Migration Examples

### Chat List Screen

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useUser } from '../context/UserContext';
import { Avatar } from '../components/Avatar';

export default function ChatListScreen() {
  const navigation = useNavigation();
  const { user } = useUser();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (user) {
      loadThreads();
      subscribeToThreads();
    }
  }, [user]);
  
  // Load threads logic
  // Subscribe to threads logic
  
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.threadItem}
      onPress={() => navigation.navigate('Chat', { threadId: item.id })}
    >
      <Avatar url={item.otherParticipant?.avatar_url} size={50} />
      <View style={styles.threadDetails}>
        <Text style={styles.threadName}>{item.otherParticipant?.username}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {getLastMessage(item)}
        </Text>
      </View>
      <Text style={styles.timeStamp}>{formatDate(item.last_message_at)}</Text>
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewChat')}>
          <Feather name="plus" size={24} color="#0088CC" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={threads}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={loadThreads}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chats yet</Text>
            <TouchableOpacity 
              style={styles.newChatButton}
              onPress={() => navigation.navigate('NewChat')}
            >
              <Text style={styles.newChatButtonText}>Start a New Chat</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles
});
```

## Database Adaptations

The Supabase database structure can remain largely the same, with adaptations for mobile-specific features:

1. Add push notification tokens table
2. Add device information for security
3. Optimize query performance for mobile devices

## Testing Strategy

1. Use Expo's testing tools
2. Test on both iOS and Android
3. Focus on encryption performance
4. Test offline capabilities
5. Verify push notifications work across platforms 