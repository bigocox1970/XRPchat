// Service Worker for XRPChat
// This service worker enables push notifications

// Cache name for the app
const CACHE_NAME = 'xrpchat-v1';

// Listen for the install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting(); // Force activation
});

// Listen for the activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  return self.clients.claim();
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);
  
  if (event.data && event.data.type === 'PLAY_NOTIFICATION_SOUND') {
    // Service workers can't play audio directly
    // Instead, we'll notify all clients to play the sound
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PLAY_NOTIFICATION_SOUND_FROM_WORKER'
        });
      });
    });
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});

// Handle push notification events
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  if (!event.data) {
    console.log('Push event had no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data:', data);

    // Notify all clients to play the notification sound
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PLAY_NOTIFICATION_SOUND_FROM_WORKER'
        });
      });
    });

    // Set default sounds and vibration patterns for better notification visibility
    const options = {
      body: data.body || 'New message received',
      icon: '/img/icon-192x192.png',
      badge: '/img/icon-72x72.png',
      data: {
        url: data.url || '/app',
        threadId: data.threadId
      },
      vibrate: [200, 100, 200], // Vibration pattern: vibrate, pause, vibrate
      sound: '/sounds/notification.mp3', // Sound file (needs to be in public folder)
      actions: [
        {
          action: 'view',
          title: 'View message'
        },
        {
          action: 'reply',
          title: 'Reply'
        }
      ],
      tag: data.tag || 'message',
      renotify: true, // Always notify even if there's already a notification with the same tag
      requireInteraction: true, // Notification remains visible until user interacts with it
      silent: false // Ensure system sound plays if possible
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'XRPChat', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  // Default action is to open the app
  let navigationUrl = '/app';
  
  // Check if we have specific data for navigation
  if (event.notification.data && event.notification.data.url) {
    navigationUrl = event.notification.data.url;
  }
  
  // Handle different actions
  if (event.action === 'view' && event.notification.data) {
    navigationUrl = event.notification.data.url;
  } else if (event.action === 'reply' && event.notification.data && event.notification.data.threadId) {
    // Open chat thread and focus reply box
    navigationUrl = `/app/chat/${event.notification.data.threadId}?focus=reply`;
  }
  
  // Close the notification
  event.notification.close();

  // Navigate to the specific chat or thread
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(navigationUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(navigationUrl);
      }
    })
  );
}); 