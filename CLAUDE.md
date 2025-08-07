# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server (Vite) on port 3000
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint with TypeScript support
- `npm run migrate` - Run database migration scripts via TypeScript

### Database Operations
- Use Supabase CLI or run migration scripts in `supabase/migrations/`
- Manual SQL migrations available in `sql/` directory
- Run `.\start-dev.ps1` on Windows PowerShell for development server

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite for building, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Auth + Storage)  
- **Encryption**: XRPL-based key generation, WebCrypto API for AES-GCM encryption
- **PWA**: Service worker, push notifications, manifest.json

### Key Architectural Patterns

#### Context-Based State Management
Multiple React contexts provide application-wide state:
- `UserContext` - Authentication and user data
- `EncryptionContext` - Message encryption/decryption logic
- `NotificationContext` - Push notification management
- `DarkModeContext` - Theme state
- `EncryptionModeContext` - Encryption toggle state  
- `DebugModeContext` - Development debugging

#### End-to-End Encryption Flow
1. Each user gets XRP wallet keypair on signup (via `utils/encryption.ts`)
2. Messages encrypted with recipient's public key using AES-GCM
3. Private keys stored in Supabase `wallets` table, optionally PIN-protected
4. Encryption/decryption handled entirely client-side

#### Database Schema (Supabase)
- `profiles` - User profiles, wallet addresses, auto-delete settings, last_active timestamps
- `wallets` - Encryption keypairs linked to profiles  
- `threads` - Chat conversations with participant lists
- `messages` - Encrypted message content, read status, sender info
- `contacts` - Friend/contact relationships between users

#### Realtime System
- Supabase Realtime subscriptions for live message updates
- Auto-delete background process runs every 5 minutes
- User presence tracking via `last_active` timestamps
- Typing indicators and read receipts

### File Structure Conventions
- `src/components/` - React UI components  
- `src/context/` - React context providers
- `src/utils/supabase/` - Database operations, organized by feature
- `src/utils/encryption.ts` - XRP wallet and encryption utilities
- `supabase/migrations/` - Database schema migrations
- `sql/` - Manual SQL scripts for specific operations

### Important Implementation Notes

#### Encryption Error Handling
The encryption system gracefully degrades if WebCrypto API unavailable - messages get prefixed with error markers like `[UNENCRYPTED]` and displayed as plaintext.

#### Windows Development
Use `start-dev.ps1` PowerShell script instead of npm scripts with `&&` operators on Windows.

#### Auto-Delete Messages  
- Settings stored both locally (localStorage) and in database (`profiles.auto_delete_settings` JSONB column)
- Background cleanup process requires `last_active` column for user presence
- Real-time status indicators show both users' auto-delete settings

#### Notification System
- Supports in-app, browser, and push notifications
- Service worker handles background notifications
- Notification preferences stored locally and in database
- Permission state carefully managed to prevent auto-prompts

#### Mobile/PWA Considerations
- App handles Supabase auth redirects with URL hash fragments
- Manifest.json configured for PWA installation
- Touch-friendly UI with responsive design

## Environment Requirements
- Node.js 18+
- Supabase project with provided schema migrations
- Environment variables in `.env`:
  - `VITE_SUPABASE_URL` 
  - `VITE_SUPABASE_ANON_KEY`