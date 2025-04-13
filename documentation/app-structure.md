# XRPChat Application Structure

## Overview
XRPChat is a secure messaging application built on XRPL (XRP Ledger) that allows users to communicate using wallet addresses. The application uses end-to-end encryption and provides features like auto-delete messages for enhanced privacy and security.

## Tech Stack

### Frontend
- **Framework**: React (with TypeScript)
- **Styling**: TailwindCSS
- **Routing**: React Router DOM
- **State Management**: Context API (React)
- **Icons**: React Icons

### Backend
- **Database & Authentication**: Supabase
- **Storage**: Supabase Storage
- **Realtime Communication**: Supabase Realtime

### Blockchain Integration
- **Library**: XRPL.js
- **Feature**: Wallet generation and management

## Core Features
1. End-to-end encrypted messaging
2. Wallet-based user identification
3. Auto-delete message functionality
4. QR code contact sharing
5. Notification system
6. Dark/Light mode
7. Security features (message expiration)

## Pages and Components

### Website (Landing Pages)
1. **Home Page** (`Website.tsx`)
   - Introduction to the app
   - CTA for sign up/sign in

2. **Features Page** (`Features.tsx`)
   - Highlights of app functionality

3. **Security Page** (`Security.tsx`)
   - Information about encryption and security features

4. **FAQ Page** (`FAQ.tsx`)
   - Common questions and answers

5. **Community Page** (`Community.tsx`)
   - Information about the community/social aspects

### Authentication Pages
1. **Sign Up** (`SignUp.tsx`)
   - User registration with email/password
   - Username creation
   - Wallet generation

2. **Sign In** (`SignIn.tsx`)
   - Email/password authentication

3. **Forgot Password** (`ForgotPassword.tsx`)
   - Password reset request

4. **Reset Password** (`ResetPassword.tsx`)
   - Password reset form

5. **Confirm Email** (`ConfirmEmail.tsx`, `TestConfirmEmail.tsx`)
   - Email verification process

### Main Application Pages
1. **Chat List** (`ChatList.tsx`)
   - List of all conversations
   - Search functionality
   - Thread management (delete, etc.)
   - Unread message indicators

2. **Chat** (`Chat.tsx`)
   - Message thread view
   - Message sending/receiving
   - Message encryption/decryption
   - Auto-delete functionality

3. **New Chat** (`NewChat.tsx`)
   - Create a new conversation
   - Select contacts

4. **Contact List** (`ContactList.tsx`)
   - Manage contacts
   - Add contacts (manual or QR code)
   - Block/unblock contacts
   - Contact status management

5. **Profile** (`Profile.tsx`)
   - User profile management
   - Avatar selection
   - Username management
   - Wallet information
   - Security settings

6. **Settings** (`Settings.tsx`)
   - Application settings
   - Auto-delete configuration
   - Notification settings
   - Dark/light mode toggle
   - Debug mode

### Layouts
1. **App Layout** (`Layout.tsx`)
   - Main application navigation
   - Mobile-responsive design

2. **Website Layout** (`WebsiteLayout.tsx`)
   - Landing page navigation

## Context Providers

1. **UserContext** (`UserContext.tsx`)
   - Authentication state
   - User profile management
   - Wallet management
   - Account operations (signup, signin, signout)

2. **NotificationContext** (`NotificationContext.tsx`)
   - Push notification management
   - In-app notifications
   - Unread message tracking
   - Notification sound

3. **EncryptionContext** (`EncryptionContext.tsx`)
   - End-to-end encryption utilities
   - Key management

4. **EncryptionModeContext** (`EncryptionModeContext.tsx`)
   - Configure encryption behavior

5. **DarkModeContext** (`DarkModeContext.tsx`)
   - Theme management

6. **DebugModeContext** (`DebugModeContext.tsx`)
   - Debug features toggle

## Database Schema

1. **Profiles Table**
   - User profiles with username and wallet information
   - Fields: id, username, avatar_url, wallet_address, updated_at, last_active

2. **Wallets Table**
   - Wallet information for users
   - Fields: id, profile_id, address, public_key, private_key, created_at, updated_at

3. **Threads Table**
   - Chat conversations
   - Fields: id, created_at, updated_at, name, participant_ids, last_message_at, created_by

4. **Messages Table**
   - Individual messages
   - Fields: id, created_at, thread_id, sender_id, content, read

## Utility Functions

1. **Authentication** (`auth.ts`)
   - User registration
   - Profile creation
   - Wallet generation

2. **Encryption** (`encryption.ts`)
   - Generating key pairs
   - Encrypting/decrypting messages

3. **Chat Management** (`chat.ts`)
   - Thread operations
   - Message operations

4. **Auto-Delete** (`autoDelete.ts`)
   - Message expiration
   - Auto-delete configuration

5. **Notifications** (`pushNotifications.ts`, `testNotifications.ts`)
   - Push notification management
   - Notification testing

6. **Supabase Client** (`client.ts`)
   - Database connection
   - Admin operations

7. **Realtime** (`realtime.ts`)
   - Real-time subscriptions for messages and threads

## Key Dependencies
- `@supabase/supabase-js`: Backend and auth
- `html5-qrcode`: QR code scanning
- `qrcode.react`: QR code generation
- `react-router-dom`: Navigation
- `xrpl`: XRP ledger integration
- `react-icons`: UI icons

## Environment Configuration
- Supabase URL and keys
- Email server configuration for notifications
- Site URL configuration for redirects 