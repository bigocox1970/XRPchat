# XRPChat Styling and UI Design Guide

## Brand Identity

Create the XRPChat app with the following visual identity elements to maintain consistency with the web version:

### Color Palette

#### Light Mode
- **Primary Color**: #075e54 (green) - Use for primary header, navigation elements
- **Secondary Color**: #128c7e (lighter green) - Use for secondary actions and accents
- **Background**: #f0f2f5 (light gray) - Main app background
- **Chat Background**: #efeae2 (WhatsApp-style light gray/green) - Background for chat screens
- **Card Background**: #FFFFFF (white) - For cards, modals, and form elements
- **Text Primary**: #1E293B (dark blue-gray) - Main text color
- **Text Secondary**: #64748B (medium blue-gray) - Secondary text, captions
- **Success**: #10B981 (green) - Positive actions, confirmations
- **Warning**: #F59E0B (amber) - Warning notices
- **Danger**: #EF4444 (red) - Error messages, destructive actions
- **Border Color**: #E2E8F0 (light gray) - Subtle borders and dividers
- **Active Element**: #25D366 (bright green) - For actions buttons and highlights
- **Message Green**: #dcf8c6 (light green) - For sent message bubbles

#### Dark Mode
- **Primary Color**: #075e54 (green) - Maintained in dark mode
- **Secondary Color**: #128c7e (lighter green) - Maintained in dark mode
- **Background**: #0F172A (dark blue-gray) - Main background color
- **Chat Background**: #0F172A (dark blue-gray) - Background for chat screens
- **Card Background**: #1E293B (dark blue) - For cards, modals, and form elements
- **Text Primary**: #F1F5F9 (off-white) - Main text color
- **Text Secondary**: #94A3B8 (light blue-gray) - Secondary text, captions
- **Border Color**: #334155 (medium blue-gray) - Subtle borders and dividers

### Typography

- **Primary Font**: "Inter", sans-serif - Use for all UI text
- **Font Weights**:
  - Regular (400): General text
  - Medium (500): Important information, subheadings
  - Semibold (600): Headings, buttons
  - Bold (700): Emphasis, important highlights
- **Font Sizes**:
  - XS: 12px
  - SM: 14px
  - Base: 16px
  - LG: 18px
  - XL: 20px
  - 2XL: 24px
  - 3XL: 30px

### UI Elements

#### Buttons
- **Primary Button**:
  - Background: Primary color (#075e54)
  - Text: White
  - Padding: 12px 16px
  - Border Radius: 8px
  - Font Weight: Semibold
- **Secondary Button**:
  - Border: 1px solid Primary color
  - Background: Transparent
  - Text: Primary color
  - Same padding and radius as primary
- **Danger Button**:
  - Background: Danger color
  - Text: White
  - Same padding and radius as primary
- **Icon Button**:
  - Size: 40px x 40px
  - Border Radius: 8px

#### Inputs
- **Text Input**:
  - Background: Card background
  - Border: 1px solid Border color
  - Border Radius: 8px
  - Padding: 12px 16px
  - Focus State: Primary color border
- **Toggle**:
  - Active: Primary color
  - Inactive: Gray (#CBD5E1)
  - Size: 40px width

#### Cards
- **Standard Card**:
  - Background: Card background
  - Border Radius: 12px
  - Shadow: subtle (0 4px 6px rgba(0,0,0,0.05))
  - Padding: 16px
- **Message Bubble (Sent)**:
  - Background: #dcf8c6 (light green) in light mode, #128c7e in dark mode
  - Border Radius: 16px 16px 0 16px
  - Color: Black in light mode, White in dark mode
- **Message Bubble (Received)**:
  - Background: Card background
  - Border Radius: 16px 16px 16px 0
  - Color: Text primary

### Iconography
- Use a consistent set of icons from Expo Vector Icons
- Icon style: Rounded/Filled for light mode, Outlined for dark mode
- Primary icon color: Text secondary
- Interactive icon color: Primary color
- Icon sizes:
  - Small: 16px
  - Medium: 20px
  - Large: 24px

### Animations & Transitions
- Smooth transitions between screens (300ms duration)
- Subtle feedback animations for actions (button presses, toggles)
- Loading indicators: Pulsing animation with primary color

## Screen-Specific Styling

### Chat List
- Avatar size: 48px diameter
- Username: Base size, Semibold weight
- Last message: SM size, Regular weight, Text secondary color
- Timestamp: XS size, Text secondary color
- Divider: 1px Border color
- Unread indicator: 8px circle, Primary color
- Selected thread: #eefaee or bg-green-100 (light green background)

### Chat Detail
- Message spacing: 8px between messages
- Timestamp: XS size, centered or within bubble (subtle)
- Input bar: Sticky to bottom, with subtle shadow, light gray background (#f0f2f5)
- Send button: Icon only, Primary color
- Day separator: Thin line with centered date text

### Profile
- Avatar size: 96px diameter
- Username: 2XL size, Semibold weight
- Wallet address: Monospace font, SM size
- Section headers: LG size, Medium weight

### Onboarding
- Large illustrations/icons for each step
- Prominent CTA buttons
- Progress indicators for multi-step flows
- Clean, minimalist layouts with ample spacing

## Responsive Design

- Optimize for various screen sizes (specifically phone and tablet)
- Adjust spacing and typography proportionally
- Maintain touch targets minimum 44px x 44px
- Account for notches, safe areas, and keyboard

## Accessibility

- Maintain WCAG AA compliance for color contrast
- Support dynamic text sizes
- Ensure all interactive elements have proper focus states
- Include support for screen readers

## Design Language

The XRPChat design aesthetic should feel:
- Clean and minimal
- Secure and trustworthy
- Modern and polished
- Focused on content
- Intuitive to navigate

Avoid excessive decoration, cluttered interfaces, or overly complex animations that would distract from the core messaging experience. 