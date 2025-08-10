// Service Worker for XRPChat
// This service worker enables push notifications

// Cache name for the app
const CACHE_NAME = 'xrpchat-cache-v1';

// Files to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json'
];

// Listen for the install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); // Force activation
});

// Listen for the activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
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
    // DISABLED: Don't show any notifications
    console.log('Notification request blocked by service worker:', event.data);
    // const { title, options } = event.data;
    // self.registration.showNotification(title, options);
  }
});

// Handle push notification events
self.addEventListener('push', (event) => {
  console.log('Push notification received, but notifications are disabled:', event);

  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data received (notifications disabled):', data);

    // DISABLED: Don't show any notifications
    // Just log that we received the push event
    event.waitUntil(Promise.resolve());
    
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

// Cache and return requests
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests or API calls
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin || 
    url.pathname.startsWith('/supabase/')
  ) {
    return;
  }

  // For HTML documents, always try network first with no-cache headers to avoid stale app state
  if (event.request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' }))
        .then(response => {
          // Make a copy of the response for the cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // For assets, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
}); 