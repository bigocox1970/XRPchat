// Push Notification Utilities

import { supabase } from './supabase/client';

// Check if push notifications are supported
export const isPushNotificationSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

// Convert base64 string to Uint8Array for the application server key
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Check if push_subscription column exists in the profiles table
export const checkPushSubscriptionColumn = async (): Promise<boolean> => {
  try {
    // Try a simple query that would fail if the column doesn't exist
    const { error } = await supabase
      .from('profiles')
      .select('push_subscription')
      .limit(1);

    // If there's no error, the column exists
    return !error;
  } catch (error) {
    console.error('Error checking for push_subscription column:', error);
    return false;
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async () => {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  try {
    // Check if the column exists first
    const columnExists = await checkPushSubscriptionColumn();
    if (!columnExists) {
      console.warn('push_subscription column does not exist in profiles table. Push notifications will not be saved to your profile.');
      console.info('Please run the SQL script in sql/add_push_notification_column.sql to add the required column.');
    }

    // Check if service worker is registered
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return subscription;
    }

    // Create new subscription
    // Note: In a production app, you would need a proper VAPID key
    // This is a placeholder key - replace with your own VAPID public key
    const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Save subscription to user profile if the column exists
    if (columnExists) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { error } = await supabase.from('profiles').update({
          push_subscription: JSON.stringify(subscription)
        }).eq('id', userData.user.id);
        
        if (error) {
          console.error('Error saving push subscription to profile:', error);
          console.warn('Push notifications will still work, but your subscription won\'t be saved to your profile.');
        }
      }
    }

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async () => {
  if (!isPushNotificationSupported()) {
    return;
  }

  try {
    // Check if the column exists first
    const columnExists = await checkPushSubscriptionColumn();

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Remove subscription from user profile if the column exists
      if (columnExists) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from('profiles').update({
            push_subscription: null
          }).eq('id', userData.user.id);
        }
      }
    }
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    throw error;
  }
};

// Get current push notification subscription
export const getCurrentPushSubscription = async () => {
  if (!isPushNotificationSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
}; 