import { supabase } from './client';

// Global tracker for active subscriptions
// This helps prevent multiple components from subscribing to the same channel
export const activeSubscriptions: Record<string, boolean> = {};

/**
 * Sets up real-time subscriptions for a thread
 */
export const subscribeToThread = (
  threadId: string,
  onMessage: (message: any) => void,
  onUpdate: (update: any) => void
) => {
  const maxRetries = 3;
  const retryDelayMs = 2000;
  let retryAttempts = 0;
  let isSubscribed = false;
  let shouldRetry = true;

  // Check if already subscribed
  const channelKey = `thread:${threadId}`;
  if (activeSubscriptions[channelKey]) {
    console.log(`Already subscribed to ${channelKey}, skipping subscription`);
    // Return a dummy cleanup function
    return () => {
      console.log(`Unsubscribe called for already subscribed channel ${channelKey}`);
    };
  }

  // Mark as active
  activeSubscriptions[channelKey] = true;

  const channel = supabase.channel(`thread:${threadId}`);

  const handleSubscribe = async (status: string) => {
    if (status === 'SUBSCRIBED') {
      isSubscribed = true;
      retryAttempts = 0;
    } else if (status === 'CLOSED' && shouldRetry && retryAttempts < maxRetries) {
      retryAttempts++;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      if (shouldRetry) {
        channel.subscribe(handleSubscribe);
      }
    } else if (status === 'CHANNEL_ERROR' && retryAttempts < maxRetries) {
      retryAttempts++;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      if (shouldRetry) {
        channel.subscribe(handleSubscribe);
      }
    } else if (retryAttempts >= maxRetries) {
      shouldRetry = false;
    }
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        if (isSubscribed) {
          onMessage(payload);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'threads',
        filter: `id=eq.${threadId}`,
      },
      (payload) => {
        if (isSubscribed) {
          try {
            onUpdate(payload);
          } catch (error) {
            console.warn(`Error handling thread update for ${threadId}:`, error);
          }
        }
      }
    )
    .subscribe(handleSubscribe);

  return () => {
    shouldRetry = false;
    channel.unsubscribe();
    // Remove from active subscriptions
    delete activeSubscriptions[channelKey];
  };
};

/**
 * Sets up real-time subscriptions for user's threads
 */
export const subscribeToUserThreads = (userId: string, onNewThread: (thread: any) => void) => {
  // Check if already subscribed
  const channelKey = `user_threads:${userId}`;
  if (activeSubscriptions[channelKey]) {
    console.log(`Already subscribed to ${channelKey}, skipping subscription`);
    // Return a dummy cleanup function
    return () => {
      console.log(`Unsubscribe called for already subscribed channel ${channelKey}`);
    };
  }
  
  // Mark as active
  activeSubscriptions[channelKey] = true;

  const channel = supabase
    .channel(`user_threads:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'threads',
        filter: `participant_ids=cs.{${userId}}`,
      },
      onNewThread
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
    // Remove from active subscriptions
    delete activeSubscriptions[channelKey];
  };
};
