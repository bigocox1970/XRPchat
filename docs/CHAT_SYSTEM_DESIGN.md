# Secure Chat System Design

## Overview
The secure chat application is built with end-to-end encryption using wallet-based keys, ensuring that messages can only be read by the intended recipients. The system uses Supabase for real-time data synchronization and user management.

## Core Components

### Authentication & Identity
- Users sign up with email/password
- Each user gets a wallet with public/private key pair
- Public key serves as user's chat identity
- Private key used for decrypting messages

### Encryption System
- Messages encrypted with recipient's public key
- Only recipient's private key can decrypt messages
- Keys stored in Supabase wallet table
- Encryption/decryption handled by EncryptionContext

### Database Schema

#### profiles
- id: uuid (primary key)
- username: string
- avatar_url: string (optional)
- wallet_address: string (public key)
- updated_at: timestamp

#### wallets
- id: uuid (primary key)
- profile_id: uuid (foreign key)
- address: string (public key)
- public_key: string
- private_key: string (encrypted)

#### threads
- id: uuid (primary key)
- created_at: timestamp
- updated_at: timestamp
- name: string
- participant_ids: uuid[]
- last_message_at: timestamp
- created_by: uuid

#### messages
- id: uuid (primary key)
- created_at: timestamp
- thread_id: uuid (foreign key)
- sender_id: uuid (foreign key)
- content: string (encrypted)
- read: boolean

### Real-time System
- Supabase Realtime used for live updates
- Subscriptions for:
  - New messages in current thread
  - Thread list updates
  - Read status changes

### Message Flow
1. User types message
2. Message encrypted with recipient's public key
3. Encrypted message stored in database
4. Realtime update triggers for recipient
5. Recipient decrypts message with private key
6. Decrypted message displayed in UI

## Security Considerations

### End-to-End Encryption
- All messages encrypted before leaving sender's device
- Only recipient's private key can decrypt messages
- Server never sees decrypted message content

### Key Management
- Private keys never leave user's device
- Public keys stored in database for message encryption
- Keys generated during signup process

### Authentication
- Email/password authentication via Supabase Auth
- Session management handled by UserContext
- Protected routes require valid session

## Performance Optimizations

### Message Loading
- Pagination for message history
- Optimistic updates for sent messages
- Message cache in ChatContext

### Real-time Updates
- Efficient subscription management
- Automatic reconnection handling
- Debounced status updates

### UI Performance
- React.memo for message components
- Virtualized message list
- Lazy loading for images

## Future Improvements

### Features
- Group chat support
- File sharing
- Message reactions
- Voice/video calls

### Technical
- Offline support
- Message queue for poor connectivity
- End-to-end encrypted file sharing
- Enhanced key rotation system
