# XRPChat User Workflows Analysis

## Authentication Flow

### New User Registration
1. User lands on Website home page
2. User clicks "Sign Up" button
3. SignUp component is loaded
4. User enters email, password, username
5. SignUp component:
   - Validates form inputs
   - Generates XRP wallet
   - Creates Supabase auth user
   - Creates profile record
   - Creates wallet record
   - Sends confirmation email
6. User is shown a screen to save their private key
7. User receives email and confirms their account
8. ConfirmEmail component handles confirmation and redirects to app

### Login Flow
1. User navigates to sign-in page
2. SignIn component is loaded
3. User enters email and password
4. UserContext handles authentication with Supabase
5. On successful login:
   - User profile is fetched
   - Wallet information is fetched
   - Auto-delete settings are loaded
6. User is redirected to app/chats

### Password Reset
1. User clicks "Forgot Password"
2. ForgotPassword component is loaded
3. User enters email
4. Supabase sends reset email
5. User clicks link in email
6. ResetPassword component handles token verification
7. User enters new password
8. Password is updated in Supabase auth

## Messaging Flows

### Starting a New Chat
1. User navigates to "New Chat" or clicks "+" icon
2. NewChat component loads list of contacts
3. User selects a contact
4. System:
   - Creates a new thread record
   - Sets up participant IDs
   - Initializes chat metadata
5. User is redirected to the chat interface

### Sending a Message
1. User types message in Chat component input
2. User clicks send or presses Enter
3. Chat component:
   - Gets encryption keys for recipients
   - Encrypts message content
   - Sends message to Supabase
   - Updates UI optimistically
4. Supabase triggers realtime event to recipient
5. If auto-delete is enabled, message expiration is set

### Receiving a Message
1. Supabase realtime subscription receives message event
2. If app is in foreground:
   - Message is added to thread
   - UI is updated
   - Unread count incremented if not viewing thread
3. If app is in background:
   - Push notification is generated
   - Notification click opens thread
4. On message view:
   - Message is decrypted using recipient's keys
   - Message is marked as read
   - Thread last_read is updated

### Managing Chats
1. User views ChatList component
2. For each thread:
   - Latest message is displayed
   - Unread count is shown
   - Timestamp is displayed
3. User can:
   - Delete threads
   - Search threads
   - Select multiple threads for batch operations

## Contact Management

### Adding a Contact
1. User navigates to Contacts tab
2. User clicks "Add Contact"
3. Options presented:
   - Manual entry of wallet address or username
   - Scan QR code
4. ContactList component:
   - Validates contact exists
   - Checks if contact already in list
   - Creates contact relationship
5. Contact appears in list with pending status
6. When other user accepts, status changes to connected

### Sharing Contact (QR Code)
1. User navigates to Profile page
2. User clicks "Share Contact"
3. QR code is generated containing:
   - User's wallet address
   - Username
4. Other user scans code using app's "Add Contact" flow

### Blocking/Unblocking Contact
1. User selects contact from list
2. User chooses "Block" action
3. Contact status is updated to "blocked"
4. Messages from blocked contacts are:
   - Not delivered
   - Not shown in thread list
5. Unblocking reverses this process

## Profile Management

### Editing Profile
1. User navigates to Profile tab
2. Profile component displays:
   - Username
   - Avatar
   - Wallet address
3. User can:
   - Change username
   - Upload new avatar
   - View wallet details

### Wallet Management
1. User navigates to Profile tab
2. User can view:
   - Wallet address
   - Public key
3. User can access private key (with confirmation)
4. Option to regenerate wallet (for security)

## Settings & Configuration

### Managing Auto-Delete
1. User navigates to Settings tab
2. Settings component shows auto-delete section
3. User can enable/disable feature
4. User can set message expiration time:
   - 1 hour
   - 24 hours
   - 7 days
   - 30 days
   - Custom
5. Settings are saved to local storage & Supabase

### Notification Settings
1. User navigates to Settings tab
2. User can enable/disable:
   - Push notifications
   - In-app notifications
   - Notification sounds
3. First-time enabling triggers browser permission request
4. Settings are saved to local storage

### Theme Settings
1. User navigates to Settings tab
2. User can toggle between:
   - Light mode
   - Dark mode
   - System preference
3. DarkModeContext updates UI immediately
4. Setting is persisted in local storage

## Security Features

### End-to-End Encryption
1. When sending message:
   - Sender's keys encrypt content
   - Each recipient can decrypt with their keys
2. Messages stored encrypted in database
3. Keys never leave client device

### Message Expiration
1. When messages are sent with auto-delete:
   - Expiration timestamp is set
   - Background process checks for expired messages
   - Expired messages are permanently deleted
2. Process runs on app initialization and periodically

## Realtime Features

### Presence & Status
1. User's online status tracked through Supabase
2. "Last active" timestamp updated periodically
3. Contacts can see when user was last online

### Message Delivery
1. Messages delivered in real-time through Supabase
2. Read receipts updated when messages viewed
3. Typing indicators show when contact is composing 