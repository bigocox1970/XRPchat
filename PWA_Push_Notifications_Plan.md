# Plan: Implementing Push Notifications for XRPChat as a PWA

## 1. Make the App a True PWA
- Ensure `manifest.json` is present and correct (name, icons, start_url, display, etc.).
- Ensure a service worker is registered in production builds.
- Test installability on Android/iOS/desktop.

## 2. Service Worker Setup
- Write a service worker (`service-worker.js`) that:
  - Listens for `push` events and displays notifications.
  - Handles notification click events to open the correct chat/thread.
- Register the service worker in your app entry point (e.g., `main.tsx`).

## 3. Push Subscription (Frontend)
- Use the Push API to subscribe the user to push notifications.
- Store the push subscription object in your backend (e.g., Supabase `profiles` table).
- Add UI for users to enable/disable push notifications and handle permission requests.

## 4. Backend Integration
- Set up a backend function (e.g., Supabase Edge Function or Node.js server) to send push notifications to subscribed users.
- When a new message is sent, trigger the backend to send a push notification to the recipient's subscription.
- Use a library like `web-push` to send notifications from the backend.

## 5. Testing
- Test push notifications on Chrome, Edge, and Android (iOS support is limited but improving).
- Test notification click actions (should open the correct chat/thread).
- Test opt-in/opt-out flows and error handling.

## 6. (Optional) Advanced Features
- Add notification badges, custom sounds, or actions (e.g., reply from notification).
- Handle background sync for missed messages.

---

**Next Steps:**
- [ ] Review and update `manifest.json` and service worker registration.
- [ ] Implement push subscription logic and UI.
- [ ] Set up backend push notification sending.
- [ ] Test end-to-end push notification flow. 