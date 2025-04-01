# XRPchat.app

A modern, secure chat application with end-to-end encryption using wallet-based keys.

## Features

- End-to-end encryption using public/private key pairs
- Real-time messaging with Supabase
- User profiles with avatars
- Contact management
- Message read receipts
- Typing indicators
- In-app and push notifications for new messages
- Notification sound alerts
- Modern, responsive UI
- Comprehensive security features
- Auto-delete messages with customizable timeframes

## Tech Stack

- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Supabase for backend and real-time
- XRP-crypto for encryption
- Service Worker API for push notifications

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
public/
├── sounds/             # Notification sound files
└── img/                # Image assets
```

### Key Components

- `App.tsx`: Main application component
- `Chat.tsx`: Chat interface
- `ChatList.tsx`: List of chat threads
- `ContactList.tsx`: Contact management
- `Profile.tsx`: User profile
- `SignUp.tsx`: Authentication
- `NotificationSettings.tsx`: Notification preferences

### Context Providers

- `UserContext`: Authentication and user state
- `EncryptionContext`: Message encryption/decryption
- `NotificationContext`: Notification management

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

## Notifications

### Notification System

XRPChat includes a comprehensive notification system:

- In-app notifications for new messages
- Browser notifications when the app is in the background
- Push notifications when the browser is closed (supported browsers only)
- Customizable notification sounds

### Setting Up Notifications

1. Enable notifications in your browser when prompted
2. Navigate to Profile > Notification Settings to configure preferences
3. Test your notification sound to ensure it's working properly

### Notification Sounds

The application uses a default notification sound located at `/public/sounds/notification.mp3`. You can:

1. Replace this file with your own sound (same filename)
2. Test the sound in the Notification Settings panel
3. Restart the application to apply changes

For more information, see the README in the `/public/sounds` directory.

## Auto-Delete Messages

### Auto-Delete Feature

XRPChat includes a robust auto-delete message system:

- Set messages to automatically delete after a specified time period
- Choose from preset options (5 minutes, 30 minutes, 1 hour, 1 day, 1 week)
- Create custom time periods using minutes, hours, days, or weeks
- Real-time status indicators showing both your and the recipient's auto-delete settings
- Settings are stored both locally and on the server (for recipient visibility)
- Visual indicators showing whether auto-delete is enabled (green) or disabled (red)

### Setting Up Auto-Delete

1. Navigate to Settings > Auto-Delete Messages
2. Choose a preset option or set a custom time period
3. Your settings are automatically saved both locally and to the server
4. When chatting, the auto-delete status card will show both users' settings
5. Messages will be automatically deleted after the specified time has elapsed

### Technical Implementation

- Settings are stored in both localStorage and the user's profile record
- A background process checks for expired messages every 5 minutes
- Messages are permanently deleted from the database when they expire
- Real-time updates via Supabase subscriptions ensure settings changes are immediately visible
- User's "last active" status is updated regularly to show online presence

### Database Requirements

Auto-delete functionality requires:
- The `auto_delete_settings` JSONB column in the `profiles` table
- The `last_active` timestamp column in the `profiles` table

Run the SQL script in `sql/auto_delete_settings_migration.sql` to add these columns.

## Troubleshooting

### SQL Policy Errors

If you encounter SQL errors when running the database setup scripts, such as:
```
ERROR: 42704: policy "Users can view their own profile information." for table "profiles" does not exist
```

This occurs because the policy names in your Supabase project might be different from the ones specified in the script. 

To fix this:
1. Use the updated script in `sql/add_push_notification_column.sql` which checks for existing policies before attempting to alter them
2. Run the script in the Supabase SQL Editor
3. The script will create new policies if they don't exist, or update existing ones

### Windows PowerShell Issues

If you encounter issues running commands with `&&` in PowerShell, use the provided PowerShell script instead:

```powershell
# Run this command in PowerShell
.\start-dev.ps1
```

This script is included in the repository and will properly start the development server.

### Notification Troubleshooting

If notifications aren't working:

1. **Check browser permissions**: Ensure your browser has granted notification permissions
2. **Verify sound file**: Make sure the notification sound file exists at `/public/sounds/notification.mp3`
3. **Check the console**: Look for any error messages related to notifications
4. **Database column**: Confirm the `push_subscription` column exists in your `profiles` table

See the [SQL README](sql/README.md) for instructions on adding the required database columns.
