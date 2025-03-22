import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase/client';
import { 
  isPushNotificationSupported, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription
} from '../utils/pushNotifications';

// Extend the notification context type
interface NotificationContextType {
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermission;
  pushNotificationsEnabled: boolean;
  pushNotificationsSupported: boolean;
  unreadCount: number;
  soundUnlocked: boolean;
  showNotification: (title: string, options?: NotificationOptions) => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  incrementUnread: () => void;
  clearUnread: () => void;
  playNotificationSound: () => void;
  unlockAudio: () => Promise<boolean>;
}

export const NotificationContext = createContext<NotificationContextType>({
  notificationsEnabled: false,
  notificationPermission: 'default',
  pushNotificationsEnabled: false,
  pushNotificationsSupported: false,
  unreadCount: 0,
  soundUnlocked: false,
  showNotification: () => {},
  requestNotificationPermission: async () => 'default',
  subscribeToPush: async () => {},
  unsubscribeFromPush: async () => {},
  incrementUnread: () => {},
  clearUnread: () => {},
  playNotificationSound: () => {},
  unlockAudio: async () => false,
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [pushNotificationsSupported, setPushNotificationsSupported] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize notification sound
    const audio = new Audio('/sounds/notification.mp3');
    audio.preload = 'auto';
    notificationSoundRef.current = audio;

    // Check if notifications are supported
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }

    // Check if push notifications are supported
    const pushSupported = isPushNotificationSupported();
    setPushNotificationsSupported(pushSupported);

    // Listen for messages from the service worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      console.log('Received message from service worker:', event.data);
      
      if (event.data && event.data.type === 'PLAY_NOTIFICATION_SOUND_FROM_WORKER') {
        // Play sound when requested by service worker
        playNotificationSound();
      }
    };

    // Try to unlock audio on various user interactions
    const unlockAudioOnInteraction = () => {
      unlockAudio().then(success => {
        if (success) {
          // Remove event listeners once audio is successfully unlocked
          document.removeEventListener('click', unlockAudioOnInteraction);
          document.removeEventListener('touchstart', unlockAudioOnInteraction);
          document.removeEventListener('keydown', unlockAudioOnInteraction);
        }
      });
    };

    // Add event listeners to unlock audio on user interaction
    document.addEventListener('click', unlockAudioOnInteraction);
    document.addEventListener('touchstart', unlockAudioOnInteraction);
    document.addEventListener('keydown', unlockAudioOnInteraction);

    // Add event listener for messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      
      // Try to register the service worker for push notifications
      navigator.serviceWorker.register('/service-worker.js')
        .then(async (registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          if (pushSupported) {
            // Check if already subscribed to push
            const subscription = await getCurrentPushSubscription();
            setPushNotificationsEnabled(!!subscription);
          }
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Clean up event listener
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      document.removeEventListener('click', unlockAudioOnInteraction);
      document.removeEventListener('touchstart', unlockAudioOnInteraction);
      document.removeEventListener('keydown', unlockAudioOnInteraction);
    };
  }, []);

  // Function to unlock audio context - must be called from a user interaction event handler
  const unlockAudio = async (): Promise<boolean> => {
    if (soundUnlocked) return true;
    
    try {
      console.log('Attempting to unlock audio...');
      // Try to play a silent sound
      if (notificationSoundRef.current) {
        notificationSoundRef.current.volume = 0.01; // Very low volume
        await notificationSoundRef.current.play();
        notificationSoundRef.current.pause();
        notificationSoundRef.current.currentTime = 0;
        notificationSoundRef.current.volume = 1.0; // Reset volume
        console.log('Audio successfully unlocked');
        setSoundUnlocked(true);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Could not unlock audio:', error);
      return false;
    }
  };

  // Request permission for notifications
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotificationsEnabled(permission === 'granted');
      
      // Try to unlock audio when requesting notification permission
      await unlockAudio();
      
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  };

  // Subscribe to push notifications
  const subscribeToPush = async () => {
    if (!pushNotificationsSupported) {
      throw new Error('Push notifications are not supported');
    }

    try {
      // Ensure we have notification permission first
      if (Notification.permission !== 'granted') {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }

      // Try to unlock audio
      await unlockAudio();

      // Subscribe to push
      await subscribeToPushNotifications();
      setPushNotificationsEnabled(true);
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setPushNotificationsEnabled(false);
      throw error;
    }
  };

  // Unsubscribe from push notifications
  const unsubscribeFromPush = async () => {
    if (!pushNotificationsSupported) {
      return;
    }

    try {
      await unsubscribeFromPushNotifications();
      setPushNotificationsEnabled(false);
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      throw error;
    }
  };

  // Show a notification
  const showNotification = (title: string, options?: NotificationOptions) => {
    if (!notificationsEnabled) return;

    try {
      // Play notification sound
      playNotificationSound();

      // Check if we can use the service worker for notifications
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options
        });
      } else {
        // Fallback to using the Notification API directly
        new Notification(title, options);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  // Increment unread counter
  const incrementUnread = () => {
    setUnreadCount((prev) => prev + 1);
  };

  // Clear unread counter
  const clearUnread = () => {
    setUnreadCount(0);
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Play sound in the main thread
      if (notificationSoundRef.current) {
        // Reset the audio to the beginning if it's already playing
        notificationSoundRef.current.pause();
        notificationSoundRef.current.currentTime = 0;
        
        console.log('Playing notification sound');
        
        // Only try to play if we have user interaction or sound is unlocked
        if (soundUnlocked || document.hasFocus()) {
          notificationSoundRef.current.play().catch(error => {
            console.error('Error playing notification sound:', error);
            // If we get an error, we might need to unlock audio again
            if (error.name === 'NotAllowedError') {
              console.warn('Audio not unlocked yet - waiting for user interaction');
              setSoundUnlocked(false);
            }
          });
        } else {
          console.warn('Audio not played - waiting for user interaction to unlock audio');
        }
      } else {
        console.warn('No notification sound reference available');
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        notificationPermission,
        pushNotificationsEnabled,
        pushNotificationsSupported,
        unreadCount,
        soundUnlocked,
        showNotification,
        requestNotificationPermission,
        subscribeToPush,
        unsubscribeFromPush,
        incrementUnread,
        clearUnread,
        playNotificationSound,
        unlockAudio
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
