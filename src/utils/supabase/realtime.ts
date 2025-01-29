import { supabase } from './client';

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

  const channel = supabase.channel(`thread:${threadId}`);

  const handleSubscribe = async (status: string) => {
    console.log(`Thread subscription status:`, status);

    if (status === 'SUBSCRIBED') {
      console.log('Successfully subscribed to thread changes');
      isSubscribed = true;
      retryAttempts = 0;
    } else if (status === 'CLOSED' && shouldRetry) {
      console.log('Channel closed, attempting to reconnect...');
      if (retryAttempts < maxRetries) {
        retryAttempts++;
        console.log(`Retrying subscription (attempt ${retryAttempts}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        if (shouldRetry) {
          channel.subscribe(handleSubscribe);
        }
      } else {
        console.error('Max retry attempts reached, giving up');
        shouldRetry = false;
      }
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Channel error occurred');
      if (retryAttempts < maxRetries) {
        retryAttempts++;
        console.log(`Retrying after error (attempt ${retryAttempts}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        if (shouldRetry) {
          channel.subscribe(handleSubscribe);
        }
      } else {
        console.error('Max retry attempts reached after error, giving up');
        shouldRetry = false;
      }
    }
  };

  channel
    .on(
      'postgres_changes',
      {
        event: '*', // Listen for all events
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        console.log('Message change received:', {
          event: payload.eventType,
          new: payload.new,
          old: payload.old
        });
        if (isSubscribed) {
          onMessage(payload);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'threads',
        filter: `id=eq.${threadId}`,
      },
      (payload) => {
        console.log('Thread change received:', payload);
        if (isSubscribed) {
          onUpdate(payload);
        }
      }
    )
    .subscribe((status) => {
      console.log('Subscription status with details:', {
        status,
        channel: channel.topic
      });
      handleSubscribe(status);
    });

  return () => {
    console.log('Unsubscribing from thread channel');
    shouldRetry = false;
    channel.unsubscribe();
  };
};

/**
 * Sets up real-time subscriptions for user's threads
 */
export const subscribeToUserThreads = (userId: string, onNewThread: (thread: any) => void) => {
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
    .subscribe((status) => {
      console.log(`User threads subscription status:`, status);
    });

  return () => {
    channel.unsubscribe();
  };
};
