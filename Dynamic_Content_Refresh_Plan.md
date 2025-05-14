# Plan: Ensuring Dynamic Content Refresh in XRPChat

## 1. Data Fetching Strategy
- Use a robust data fetching library (e.g., React Query or SWR) for all dynamic content (chats, contacts, profile, etc.).
- Configure automatic re-fetching on:
  - App/tab focus (`window.focus` event)
  - App visibility (`visibilitychange` event)
  - Network reconnect
- Use caching to avoid unnecessary reloads and provide instant UI feedback.

## 2. Real-Time Subscription Management
- On app/tab focus or visibility, re-establish any real-time subscriptions (e.g., Supabase channels for messages/threads).
- Clean up subscriptions on unmount or when leaving a page.
- Optionally, debounce or throttle re-subscription to avoid excessive reconnects.

## 3. State Management
- Use a state management solution (React Context, Zustand, Redux, or React Query cache) to persist chat/contact state across navigation and backgrounding.
- Avoid resetting state to `null` unless the user logs out.
- Hydrate state from cache or last known data on app resume.

## 4. UI/UX Improvements
- Show a subtle loading indicator only when truly needed (e.g., after a failed fetch or on first load).
- Avoid full-page spinners for background refreshes.
- Provide a manual refresh button for users.

## 5. Mobile-Specific Considerations
- Test on iOS and Android for background/foreground transitions.
- Handle browser quirks (e.g., Safari suspending JS, Android killing tabs).
- Consider using Service Worker background sync for missed updates (PWA only).

---

**Next Steps:**
- [ ] Choose and set up a data fetching library (React Query/SWR).
- [ ] Refactor chat/contact/profile fetching to use the library.
- [ ] Add focus/visibility/network listeners to trigger re-fetch and re-subscribe.
- [ ] Test on mobile devices for reliability. 