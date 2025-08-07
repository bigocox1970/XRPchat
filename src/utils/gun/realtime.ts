import { gun } from './client';
import { GunMessage, GunThread } from './chat';

// Global tracker for active subscriptions
export const activeGunSubscriptions: Record<string, () => void> = {};

/**
 * Subscribe to real-time messages in a thread
 */
export const subscribeToGunThread = (
  threadId: string,
  onMessage: (message: GunMessage) => void,
  onUpdate?: (thread: GunThread) => void
) => {
  const subscriptionKey = `thread:${threadId}`;
  
  // Prevent duplicate subscriptions
  if (activeGunSubscriptions[subscriptionKey]) {
    console.log(`Already subscribed to ${subscriptionKey}`);
    return activeGunSubscriptions[subscriptionKey];
  }

  console.log(`Subscribing to Gun thread: ${threadId}`);

  // Subscribe to new messages in the thread
  const messageSubscription = gun.get('thread_messages').get(threadId).map().on((message: GunMessage, key: string) => {
    if (message && message.id && key !== '_') {
      console.log(`New message received in thread ${threadId}:`, message.id);
      onMessage(message);
    }
  });

  // Subscribe to thread updates if callback provided
  let threadSubscription: any = null;
  if (onUpdate) {
    threadSubscription = gun.get('thread').get(threadId).on((thread: GunThread, key: string) => {
      if (thread && key !== '_') {
        console.log(`Thread updated: ${threadId}`);
        onUpdate(thread);
      }
    });
  }

  // Cleanup function
  const cleanup = () => {
    console.log(`Unsubscribing from Gun thread: ${threadId}`);
    if (messageSubscription && typeof messageSubscription.off === 'function') {
      messageSubscription.off();
    }
    if (threadSubscription && typeof threadSubscription.off === 'function') {
      threadSubscription.off();
    }
    delete activeGunSubscriptions[subscriptionKey];
  };

  activeGunSubscriptions[subscriptionKey] = cleanup;
  return cleanup;
};

/**
 * Subscribe to new threads for a user
 */
export const subscribeToGunUserThreads = (
  userId: string,
  onNewThread: (thread: GunThread) => void
) => {
  const subscriptionKey = `user_threads:${userId}`;
  
  // Prevent duplicate subscriptions
  if (activeGunSubscriptions[subscriptionKey]) {
    console.log(`Already subscribed to ${subscriptionKey}`);
    return activeGunSubscriptions[subscriptionKey];
  }

  console.log(`Subscribing to Gun user threads: ${userId}`);

  // Subscribe to new threads added to user's thread list
  const subscription = gun.get('user_threads').get(userId).map().on((threadRef: any, key: string) => {
    if (threadRef && threadRef.thread_id && key !== '_') {
      // Get the full thread data
      gun.get('thread').get(threadRef.thread_id).once((thread: GunThread) => {
        if (thread) {
          console.log(`New thread found for user ${userId}:`, thread.id);
          onNewThread(thread);
        }
      });
    }
  });

  // Cleanup function
  const cleanup = () => {
    console.log(`Unsubscribing from Gun user threads: ${userId}`);
    if (subscription && typeof subscription.off === 'function') {
      subscription.off();
    }
    delete activeGunSubscriptions[subscriptionKey];
  };

  activeGunSubscriptions[subscriptionKey] = cleanup;
  return cleanup;
};

/**
 * Subscribe to typing indicators for a thread
 */
export const subscribeToTypingIndicators = (
  threadId: string,
  onTypingUpdate: (data: { userId: string; isTyping: boolean; timestamp: string }) => void
) => {
  const subscriptionKey = `typing:${threadId}`;
  
  if (activeGunSubscriptions[subscriptionKey]) {
    console.log(`Already subscribed to typing indicators for ${subscriptionKey}`);
    return activeGunSubscriptions[subscriptionKey];
  }

  console.log(`Subscribing to typing indicators for thread: ${threadId}`);

  const subscription = gun.get('typing').get(threadId).map().on((typingData: any, userId: string) => {
    if (typingData && userId !== '_') {
      onTypingUpdate({
        userId,
        isTyping: typingData.isTyping || false,
        timestamp: typingData.timestamp || new Date().toISOString()
      });
    }
  });

  // Cleanup function
  const cleanup = () => {
    console.log(`Unsubscribing from typing indicators for thread: ${threadId}`);
    if (subscription && typeof subscription.off === 'function') {
      subscription.off();
    }
    delete activeGunSubscriptions[subscriptionKey];
  };

  activeGunSubscriptions[subscriptionKey] = cleanup;
  return cleanup;
};

/**
 * Update typing indicator for current user
 */
export const updateTypingIndicator = (threadId: string, userId: string, isTyping: boolean) => {
  const typingData = {
    isTyping,
    timestamp: new Date().toISOString()
  };

  gun.get('typing').get(threadId).get(userId).put(typingData);

  // Auto-clear typing indicator after 3 seconds
  if (isTyping) {
    setTimeout(() => {
      gun.get('typing').get(threadId).get(userId).put({
        isTyping: false,
        timestamp: new Date().toISOString()
      });
    }, 3000);
  }
};

/**
 * Subscribe to user presence (online/offline status)
 */
export const subscribeToUserPresence = (
  userId: string,
  onPresenceUpdate: (data: { isOnline: boolean; lastSeen: string }) => void
) => {
  const subscriptionKey = `presence:${userId}`;
  
  if (activeGunSubscriptions[subscriptionKey]) {
    return activeGunSubscriptions[subscriptionKey];
  }

  console.log(`Subscribing to presence for user: ${userId}`);

  const subscription = gun.get('presence').get(userId).on((presenceData: any) => {
    if (presenceData) {
      onPresenceUpdate({
        isOnline: presenceData.isOnline || false,
        lastSeen: presenceData.lastSeen || new Date().toISOString()
      });
    }
  });

  // Cleanup function
  const cleanup = () => {
    if (subscription && typeof subscription.off === 'function') {
      subscription.off();
    }
    delete activeGunSubscriptions[subscriptionKey];
  };

  activeGunSubscriptions[subscriptionKey] = cleanup;
  return cleanup;
};

/**
 * Update user presence
 */
export const updateUserPresence = (userId: string, isOnline: boolean) => {
  const presenceData = {
    isOnline,
    lastSeen: new Date().toISOString()
  };

  gun.get('presence').get(userId).put(presenceData);
};

/**
 * Subscribe to contact status updates
 */
export const subscribeToContactUpdates = (
  userId: string,
  onContactUpdate: (contactData: any) => void
) => {
  const subscriptionKey = `contacts:${userId}`;
  
  if (activeGunSubscriptions[subscriptionKey]) {
    return activeGunSubscriptions[subscriptionKey];
  }

  console.log(`Subscribing to contact updates for user: ${userId}`);

  const subscription = gun.get('contacts').get(userId).map().on((contact: any, contactId: string) => {
    if (contact && contactId !== '_') {
      onContactUpdate({ ...contact, id: contactId });
    }
  });

  // Cleanup function
  const cleanup = () => {
    if (subscription && typeof subscription.off === 'function') {
      subscription.off();
    }
    delete activeGunSubscriptions[subscriptionKey];
  };

  activeGunSubscriptions[subscriptionKey] = cleanup;
  return cleanup;
};

/**
 * Clean up all active subscriptions
 */
export const cleanupAllGunSubscriptions = () => {
  console.log('Cleaning up all Gun subscriptions...');
  
  Object.values(activeGunSubscriptions).forEach(cleanup => {
    try {
      cleanup();
    } catch (error) {
      console.warn('Error during subscription cleanup:', error);
    }
  });
  
  // Clear the subscriptions object
  Object.keys(activeGunSubscriptions).forEach(key => {
    delete activeGunSubscriptions[key];
  });
  
  console.log('All Gun subscriptions cleaned up');
};

/**
 * Get active subscription count (for debugging)
 */
export const getActiveSubscriptionCount = () => {
  return Object.keys(activeGunSubscriptions).length;
};