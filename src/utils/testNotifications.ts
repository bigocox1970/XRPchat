/**
 * Utility functions for testing the notification system
 */

import { supabase } from './supabase/client';
import { checkPushSubscriptionColumn } from './pushNotifications';

/**
 * Test sending a push notification
 * @param title Notification title
 * @param body Notification body
 * @param threadId Optional thread ID to link to
 */
export const testPushNotification = async (
  title: string = 'Test Notification',
  body: string = 'This is a test notification from XRPChat.',
  threadId?: string
) => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if the push_subscription column exists
    const columnExists = await checkPushSubscriptionColumn();
    if (!columnExists) {
      console.warn('The push_subscription column does not exist in the profiles table');
      throw new Error('Database not configured for push notifications. Please run the SQL script first.');
    }

    // Get user's profile to check for push subscription
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('push_subscription')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error retrieving profile data:', profileError);
      throw new Error('Could not retrieve user profile data');
    }

    if (!profileData) {
      throw new Error('User profile not found');
    }

    // Check if user has a push subscription
    if (!profileData.push_subscription) {
      throw new Error('No push subscription found. Enable push notifications in your profile settings first.');
    }

    console.log('Sending test push notification...');

    // In a real implementation, this would call your server endpoint
    // that would use web-push or a similar library to send the actual push notification
    // For this test implementation, we'll simulate it with a local notification

    // First, play the notification sound
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(error => {
      console.error('Error playing notification sound:', error);
    });

    // Then show a local notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/img/icon-192x192.png',
        data: {
          url: threadId ? `/app/chat/${threadId}` : '/app',
          threadId
        },
        tag: 'test',
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navigate to thread if provided
        if (threadId) {
          window.location.href = `/app/chat/${threadId}`;
        }
      };

      return true;
    } else {
      throw new Error('Notification permission not granted');
    }
  } catch (error) {
    console.error('Error sending test push notification:', error);
    throw error;
  }
};

/**
 * Test an in-app notification
 * @param title Notification title
 * @param body Notification body
 */
export const testInAppNotification = (
  title: string = 'Test In-App Notification',
  body: string = 'This is a test in-app notification.'
) => {
  try {
    // This function would integrate with your in-app notification system
    // For example, dispatching an event that your notification component listens for
    
    // For this test implementation, we'll just play the sound and log to console
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(error => {
      console.error('Error playing notification sound:', error);
    });
    
    console.log('🔔 IN-APP NOTIFICATION:', title, body);
    
    // Dispatch custom event for potential listeners
    const event = new CustomEvent('inAppNotification', {
      detail: { title, body }
    });
    window.dispatchEvent(event);
    
    return true;
  } catch (error) {
    console.error('Error testing in-app notification:', error);
    throw error;
  }
};

/**
 * Check notification permissions
 * @returns Current notification permission status
 */
export const checkNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  
  return Notification.permission;
};

/**
 * Request notification permission
 * @returns Promise resolving to the permission status
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}; 