# File Structure Documentation

## Root Directory
```
v2/
├── src/               # Source code
├── public/            # Static assets
├── docs/             # Documentation
└── package.json      # Project configuration
```

## Source Code Structure
```
src/
├── components/        # React components
│   ├── Chat.tsx          # Main chat interface
│   ├── ChatList.tsx      # List of chat threads
│   ├── ContactList.tsx   # Contact management
│   ├── Profile.tsx       # User profile
│   └── SignUp.tsx        # Authentication
│
├── context/          # React context providers
│   ├── UserContext.tsx       # User authentication state
│   └── EncryptionContext.tsx # Message encryption
│
├── utils/            # Utility functions
│   ├── supabase.ts       # Database operations
│   └── encryption.ts     # Encryption operations
│
├── types/            # TypeScript type definitions
│   ├── supabase.ts       # Database types
│   └── env.d.ts          # Environment variables
│
├── App.tsx           # Main application component
├── main.tsx         # Application entry point
└── index.css        # Global styles
```

## Documentation Structure
```
docs/
├── CHAT_SYSTEM_DESIGN.md    # System architecture
├── DATABASE_SETUP.md        # Database schema and setup
├── SYSTEM_COMPARISON.md     # Old vs new system
├── RECOMMENDATION.md        # Implementation plan
└── FILE_STRUCTURE.md        # This file
```

## Configuration Files
```
v2/
├── .env                 # Environment variables
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── tsconfig.node.json   # Node-specific TS config
├── vite.config.ts       # Vite configuration
├── postcss.config.js    # PostCSS configuration
└── tailwind.config.js   # Tailwind CSS configuration
```

## Component Details

### Chat Components
- `Chat.tsx`: Main chat interface with message display and input
- `ChatList.tsx`: Displays list of chat threads with previews
- `ContactList.tsx`: Contact search and management
- `Profile.tsx`: User profile management and settings
- `SignUp.tsx`: User registration and authentication

### Context Providers
- `UserContext.tsx`: Manages user authentication state and profile
- `EncryptionContext.tsx`: Handles message encryption/decryption

### Utility Functions
- `supabase.ts`: Database operations and real-time subscriptions
- `encryption.ts`: Message encryption using wallet keys

### Type Definitions
- `supabase.ts`: Database and API types
- `env.d.ts`: Environment variable types

## Style Structure
```
styles/
├── index.css           # Global styles and Tailwind imports
└── components/         # Component-specific styles (if needed)
```

## Build Output
```
dist/                # Production build output
├── assets/         # Bundled assets
└── index.html      # Entry point
```

## Development Tools

### Scripts
```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "lint": "eslint src --ext ts,tsx",
  "preview": "vite preview"
}
```

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## File Naming Conventions

### Components
- PascalCase for component files (e.g., `ChatList.tsx`)
- Each component in its own file
- Optional styles in same directory

### Utilities
- camelCase for utility files (e.g., `encryption.ts`)
- Group related utilities in directories

### Types
- camelCase for type files (e.g., `supabase.ts`)
- Suffix interfaces with 'Type' or 'Props'

### Tests
- Same name as tested file with `.test.ts` suffix

## Import Organization
```typescript
// External imports
import React from 'react'
import { useNavigate } from 'react-router-dom'

// Context imports
import { useUser } from '../context/UserContext'

// Component imports
import { Chat } from './Chat'

// Utility imports
import { encryptMessage } from '../utils/encryption'

// Type imports
import type { Message } from '../types/supabase'
```

## Code Organization Guidelines

### Components
- Props interface at top
- Hooks after props
- Helper functions before render
- JSX at bottom

### Context
- Types at top
- Context creation
- Provider component
- Hook export

### Utils
- Type imports
- Function exports
- Helper functions
- Type exports

This structure ensures:
- Clear separation of concerns
- Easy navigation
- Consistent organization
- Scalable architecture
