# Secure Chat Application v2

A modern, secure chat application with end-to-end encryption using wallet-based keys.

## Features

- End-to-end encryption using public/private key pairs
- Real-time messaging with Supabase
- User profiles with avatars
- Contact management
- Message read receipts
- Typing indicators
- Modern, responsive UI
- Comprehensive security features

## Tech Stack

- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Supabase for backend and real-time
- eth-crypto for encryption

## Prerequisites

- Node.js 18+
- npm 8+
- Supabase account and project

## Environment Setup

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── components/          # React components
├── context/            # Context providers
├── utils/              # Utility functions
├── types/              # TypeScript types
└── docs/              # Documentation
```

### Key Components

- `App.tsx`: Main application component
- `Chat.tsx`: Chat interface
- `ChatList.tsx`: List of chat threads
- `ContactList.tsx`: Contact management
- `Profile.tsx`: User profile
- `SignUp.tsx`: Authentication

### Context Providers

- `UserContext`: Authentication and user state
- `EncryptionContext`: Message encryption/decryption

## Documentation

- [System Design](docs/CHAT_SYSTEM_DESIGN.md)
- [System Comparison](docs/SYSTEM_COMPARISON.md)
- [Recommendation](docs/RECOMMENDATION.md)

## Development

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

### Code Style

- ESLint for code linting
- Prettier for code formatting
- TypeScript strict mode enabled

## Security

### Encryption

- Messages encrypted with recipient's public key
- Private keys never leave the user's device
- Zero knowledge server architecture

### Authentication

- Email/password via Supabase Auth
- Session management
- Protected routes

## Database Schema

See [CHAT_SYSTEM_DESIGN.md](docs/CHAT_SYSTEM_DESIGN.md) for detailed database schema.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, please check:
1. Documentation in `/docs`
2. Issue tracker
3. Contact development team

## Roadmap

See [RECOMMENDATION.md](docs/RECOMMENDATION.md) for future plans and improvements.
