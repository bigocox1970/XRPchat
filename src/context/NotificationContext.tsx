import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase/client';
import { useUser } from '../context/UserContext';
import { 
  isPushNotificationSupported, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription
} from '../utils/pushNotifications';

// Additional safeties to prevent auto-requesting
const AUTO_REQUEST_ENABLED = false; // Set to false to completely disable auto-requesting
const CHECK_NOTIFICATION_REQUESTED_KEY = 'xrpchat_notification_user_choice';

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
  updateNotificationState: () => void;
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
  updateNotificationState: () => {},
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [pushNotificationsSupported, setPushNotificationsSupported] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [autoRequestAttempted, setAutoRequestAttempted] = useState(false);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const mobileAudioRef = useRef<HTMLAudioElement | null>(null);
  // Track if we've had user interaction that would unlock audio
  const hasUserInteractedRef = useRef<boolean>(false);
  // Track audio playback state to prevent overlapping calls
  const isPlayingRef = useRef<boolean>(false);
  // Track the last time the sound was played for debouncing
  const lastPlayedTimeRef = useRef<number>(0);

  // Function to update notification state from localStorage
  const updateNotificationState = () => {
    console.log('Manually updating notification state from localStorage');
    if ('Notification' in window) {
      // Get current status from localStorage
      const notificationsEnabledSetting = localStorage.getItem('xrpchat_notifications_enabled');
      const savedPermission = localStorage.getItem('xrpchat_notification_permission');
      
      console.log('Current localStorage notification settings:', {
        enabled: notificationsEnabledSetting,
        permission: savedPermission,
        currentContext: notificationsEnabled
      });
      
      // Update state based on localStorage values
      if (notificationsEnabledSetting === 'true' && savedPermission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(false);
      }
      
      // Update permission state
      setNotificationPermission(Notification.permission);
      
      console.log('Notification state updated:', { 
        enabled: notificationsEnabledSetting === 'true',
        permission: Notification.permission
      });
      
      // Broadcast this change to ensure all components are in sync
      // Use a different event than 'storage' to prevent infinite loops
      const event = new CustomEvent('notificationStateChange', {
        detail: {
          enabled: notificationsEnabledSetting === 'true',
          permission: Notification.permission
        }
      });
      window.dispatchEvent(event);
    }
  };

  useEffect(() => {
    // Initialize notification sound with cache-busting parameter
    try {
      // Add random parameter to prevent caching issues
      const audio = new Audio(`/sounds/notification.mp3?v=${Date.now()}`);
      audio.preload = 'auto';
      audio.volume = 0.5; // Set a reasonable volume level
      
      // Add special handling for mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('Mobile device detected, using special audio initialization');
        
        // For iOS compatibility, also try to load a second audio element with different settings
        try {
          const mobileAudio = new Audio();
          mobileAudio.autoplay = false;
          mobileAudio.src = `/sounds/notification.mp3?mobile=${Date.now()}`;
          mobileAudio.load();
          
          // Keep reference to both audio elements
          mobileAudioRef.current = mobileAudio;
        } catch (mobileError) {
          console.error('Error creating mobile-specific audio element:', mobileError);
        }
      }
      
      // Use the load() method to start preloading the sound
      audio.load();
      
      notificationSoundRef.current = audio;
      
      console.log('Notification sound initialized successfully');
    } catch (error) {
      console.error('Failed to initialize notification sound:', error);
    }

    // Try to play a silent sound on initialization to check if audio is already unlocked
    try {
      // Simplified initialization - just check if audio API is available
      if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
        console.log('Audio API is available, may need user interaction to unlock');
      } else {
        console.log('Audio API not available in this browser');
      }
    } catch (error) {
      console.log('Audio context check failed:', error);
    }

    // Check if notifications are supported
    if ('Notification' in window) {
      // Check if notifications are enabled in user settings
      const notificationsEnabledSetting = localStorage.getItem('xrpchat_notifications_enabled');
      const savedPermission = localStorage.getItem('xrpchat_notification_permission');
      
      // Set notifications enabled state based on user preference
      if (notificationsEnabledSetting === 'true' && savedPermission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(false);
      }
      
      // Set current permission state for UI feedback
      setNotificationPermission(Notification.permission);
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

    // Track user interactions that would unlock audio
    const markUserInteraction = () => {
      hasUserInteractedRef.current = true;
      unlockAudio().then(unlocked => {
        if (unlocked) {
          document.removeEventListener('click', markUserInteraction, true);
          document.removeEventListener('touchstart', markUserInteraction, true);
          document.removeEventListener('keydown', markUserInteraction, true);
        }
      });
    };

    // Add event listeners with capture to ensure they run first
    document.addEventListener('click', markUserInteraction, true);
    document.addEventListener('touchstart', markUserInteraction, true);
    document.addEventListener('keydown', markUserInteraction, true);

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

    // Add storage event listener to respond to changes in localStorage
    // This will allow notification settings to update across tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'xrpchat_notifications_enabled' || 
          event.key === 'xrpchat_notification_permission' ||
          event.key === 'xrpchat_notification_user_choice') {
        console.log('Notification settings changed in localStorage, updating state');
        updateNotificationState();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    // Clean up event listener
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      document.removeEventListener('click', markUserInteraction, true);
      document.removeEventListener('touchstart', markUserInteraction, true);
      document.removeEventListener('keydown', markUserInteraction, true);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Function to unlock audio context - must be called from a user interaction event handler
  const unlockAudio = async (): Promise<boolean> => {
    if (soundUnlocked) return true;
    
    // If audio is currently playing, don't try to unlock again
    if (isPlayingRef.current) return false;
    
    try {
      console.log('Attempting to unlock audio...');
      
      // Set a flag to prevent concurrent unlock operations
      isPlayingRef.current = true;
      
      try {
        // Strategy 1: Play silent sound with our notification sound reference
        if (notificationSoundRef.current) {
          try {
            // Make it silent
            notificationSoundRef.current.volume = 0.001;
            // Add delay between operations to ensure they complete
            await notificationSoundRef.current.play();
            await new Promise(r => setTimeout(r, 50));
            notificationSoundRef.current.pause();
            await new Promise(r => setTimeout(r, 50));
            notificationSoundRef.current.currentTime = 0;
            notificationSoundRef.current.volume = 0.5;
            console.log('Audio successfully unlocked with notification sound ref');
            setSoundUnlocked(true);
            return true;
          } catch (playError) {
            console.warn('Could not unlock with notification sound ref:', playError);
          }
        }
        
        // Strategy 2: Create a new audio element and try to play it
        try {
          const tempAudio = new Audio();
          tempAudio.volume = 0.001;
          await tempAudio.play();
          await new Promise(r => setTimeout(r, 50));
          tempAudio.pause();
          console.log('Audio successfully unlocked with temp audio');
          setSoundUnlocked(true);
          return true;
        } catch (tempError) {
          console.warn('Could not unlock with temp audio:', tempError);
        }
        
        // Strategy 3: Web Audio API
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            // Create an oscillator and handle it safely
            const oscillator = audioCtx.createOscillator();
            oscillator.frequency.value = 0; // Silent
            oscillator.connect(audioCtx.destination);
            oscillator.start();
            await new Promise(r => setTimeout(r, 50));
            oscillator.stop(audioCtx.currentTime + 0.001);
            console.log('Audio successfully unlocked with AudioContext');
            setSoundUnlocked(true);
            return true;
          }
        } catch (audioContextError) {
          console.warn('Could not unlock with AudioContext:', audioContextError);
        }
        
        console.warn('All audio unlock strategies failed');
        return false;
      } finally {
        // Reset the playing flag no matter what happens
        isPlayingRef.current = false;
      }
    } catch (error) {
      // Handle any unexpected errors
      console.warn('Unexpected error in unlockAudio:', error);
      isPlayingRef.current = false;
      return false;
    }
  };

  // Request permission for notifications
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    try {
      // Check if we already have permission
      if (Notification.permission === 'granted') {
        localStorage.setItem('xrpchat_notification_requested', 'true');
        localStorage.setItem('xrpchat_notification_user_choice', 'true');
        localStorage.setItem('xrpchat_notification_permission', 'granted');
        setNotificationsEnabled(true);
        return 'granted';
      }
      
      // Check if permission was previously denied
      if (Notification.permission === 'denied') {
        localStorage.setItem('xrpchat_notification_requested', 'true');
        localStorage.setItem('xrpchat_notification_user_choice', 'true');
        localStorage.setItem('xrpchat_notification_permission', 'denied');
        setNotificationsEnabled(false);
        return 'denied';
      }

      // Request permission
      console.log('Requesting notification permission after user interaction');
      const permission = await Notification.requestPermission();
      
      // Store the result
      localStorage.setItem('xrpchat_notification_requested', 'true');
      localStorage.setItem('xrpchat_notification_user_choice', 'true');
      localStorage.setItem('xrpchat_notification_permission', permission);
      
      // Update enabled state
      setNotificationsEnabled(permission === 'granted');
      setNotificationPermission(permission);
      
      // Emit event to notify other components of the change
      window.dispatchEvent(new CustomEvent('notificationStateChange', {
        detail: { permission }
      }));
      
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
  const showNotification = (title: string, options?: NotificationOptions & { senderId?: string }) => {
    // Extract the sender ID if provided
    const senderId = options?.senderId;
    
    // Check if this is our own message - never play sounds for our own messages
    if (senderId && user?.id === senderId) {
      console.log('Not playing sound for our own message - sender ID matches current user');
      return;
    }
    
    // Also check the last message sender flag from localStorage
    const lastMessageSender = localStorage.getItem('xrpchat_last_message_sender');
    if (lastMessageSender && senderId && lastMessageSender === senderId) {
      console.log('Not playing sound for message - matches last message sender ID');
      return;
    }
    
    // Check if notifications are enabled by user preference
    const notificationsEnabled = localStorage.getItem('xrpchat_notifications_enabled') === 'true';
    const permissionGranted = localStorage.getItem('xrpchat_notification_permission') === 'granted';
    
    if (!notificationsEnabled || !permissionGranted) {
      console.log('Notification not shown - disabled by user preference:', title, options);
      return;
    }
    
    // Log the notification that would have been shown
    console.log('Notification received:', title, options);
    
    // If already playing, don't try to unlock audio again
    if (isPlayingRef.current) {
      console.log('Audio already playing, skipping additional unlocking attempts');
      return;
    }
    
    // Simply call playNotificationSound which now has debounce and safety checks
    playNotificationSound();
  };

  // Increment unread counter
  const incrementUnread = () => {
    setUnreadCount((prev) => prev + 1);
  };

  // Clear unread counter
  const clearUnread = () => {
    setUnreadCount(0);
  };

  // Play notification sound with better handling and debounce
  const playNotificationSound = () => {
    if (!notificationSoundRef.current) {
      console.warn('No notification sound reference available');
      return;
    }
    
    // Debounce - don't play sounds too frequently (at least 1 second apart)
    const now = Date.now();
    if (now - lastPlayedTimeRef.current < 1000) {
      console.log('Notification sound debounced - played too recently');
      return;
    }
    
    // Don't attempt to play if already playing
    if (isPlayingRef.current) {
      console.log('Notification sound already playing, skipping');
      return;
    }
    
    // Detect mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      // Mark as playing to prevent overlapping calls
      isPlayingRef.current = true;
      
      // Try unlocking audio if needed
      if (!soundUnlocked && hasUserInteractedRef.current) {
        unlockAudio().catch(() => {
          console.warn('Failed to unlock audio before playing');
        });
      }
      
      // Create a promise to handle sequential audio operations with minimal delays
      const playSound = async () => {
        try {
          // Reset to start with small delay to ensure previous operations complete
          notificationSoundRef.current!.pause();
          await new Promise(r => setTimeout(r, 10)); // Small delay
          notificationSoundRef.current!.currentTime = 0;
          await new Promise(r => setTimeout(r, 10)); // Small delay
          
          console.log('Attempting to play notification sound...');
          notificationSoundRef.current!.volume = isMobile ? 1.0 : 0.5; // Higher volume on mobile
          
          // Special handling for iOS
          if (isMobile && mobileAudioRef.current) {
            try {
              // Try the mobile-specific audio element first
              mobileAudioRef.current.volume = 1.0;
              mobileAudioRef.current.currentTime = 0;
              await mobileAudioRef.current.play();
              console.log('Mobile notification sound played successfully');
              lastPlayedTimeRef.current = Date.now();
              setSoundUnlocked(true);
              return;
            } catch (mobilePlayError) {
              console.warn('Mobile-specific audio failed, falling back to standard approach:', mobilePlayError);
            }
          }
          
          // Play the sound and handle result
          await notificationSoundRef.current!.play();
          console.log('Notification sound played successfully');
          
          // Record the time to implement debouncing
          lastPlayedTimeRef.current = Date.now();
          setSoundUnlocked(true);
        } catch (error) {
          console.error('Error playing notification sound:', error);
          if (error instanceof Error && error.name === 'NotAllowedError') {
            console.warn('Audio not unlocked yet - needs user interaction');
            setSoundUnlocked(false);
          }
        } finally {
          // Reset playing flag when done
          isPlayingRef.current = false;
        }
      };
      
      // Execute the sound playing sequence
      playSound();
    } catch (error) {
      // If any unexpected error occurs, make sure to reset the playing flag
      console.error('Unexpected error in playNotificationSound:', error);
      isPlayingRef.current = false;
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
        unlockAudio,
        updateNotificationState
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
