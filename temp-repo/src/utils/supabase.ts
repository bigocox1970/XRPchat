import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Client for authenticated and anonymous operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  }
});

// Admin client for service role operations (like creating profiles during signup)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey, // Fallback to anon key if service key not available
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

/**
 * Creates a new user profile with wallet
 */
export const createProfile = async (
  userId: string,
  username: string,
  walletAddress: string
) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username,
        wallet_address: walletAddress,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error creating profile:', error);
    throw error;
  }
};

/**
 * Creates a new wallet entry
 */
export const createWallet = async (
  profileId: string,
  address: string,
  publicKey: string,
  privateKey: string
) => {
  try {
    const { error } = await supabaseAdmin
      .from('wallets')
      .insert({
        profile_id: profileId,
        address,
        public_key: publicKey,
        private_key: privateKey,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
};

/**
 * Confirms a user's email
 */
export const confirmUser = async (userId: string) => {
  try {
    const { error } = await supabaseAdmin
      .rpc('confirm_user', { user_id: userId });

    if (error) throw error;
  } catch (error) {
    console.error('Error confirming user:', error);
    throw error;
  }
};

/**
 * Gets a user's profile by ID
 */
export const getProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting profile:', error);
    throw error;
  }
};

/**
 * Gets a user's wallet by profile ID
 */
export const getWallet = async (profileId: string) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting wallet:', error);
    throw error;
  }
};

/**
 * Creates a new chat thread
 */
export const createThread = async (
  name: string,
  participantIds: string[],
  createdBy: string
) => {
  try {
    console.log('Creating thread with:', {
      name,
      participantIds,
      createdBy
    });

    const { data, error } = await supabase
      .from('threads')
      .insert({
        name,
        participant_ids: participantIds,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating thread:', {
        error,
        errorMessage: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    if (!data) {
      console.error('No data returned from thread creation');
      throw new Error('Thread creation failed - no data returned');
    }

    console.log('Thread created successfully:', data);
    return data;
  } catch (error) {
    console.error('Detailed error creating thread:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

/**
 * Gets all threads for a user
 */
export const getUserThreads = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        messages (
          id,
          created_at,
          sender_id,
          content,
          read
        )
      `)
      .contains('participant_ids', [userId])
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user threads:', error);
    throw error;
  }
};

/**
 * Gets messages for a thread with pagination
 */
export const getThreadMessages = async (
  threadId: string,
  limit = 50,
  startFrom?: string
) => {
  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startFrom) {
      query = query.lt('created_at', startFrom);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting thread messages:', error);
    throw error;
  }
};

/**
 * Sends a new message in a thread
 */
export const sendMessage = async (
  threadId: string,
  senderId: string,
  content: string
) => {
  try {
    console.log('Sending message with:', { threadId, senderId, contentLength: content.length });
    
    // Insert message directly
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_id: senderId,
        content: content,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error inserting message:', messageError);
      throw messageError;
    }

    // Update thread's last_message_at
    const { error: threadError } = await supabase
      .from('threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', threadId);

    if (threadError) {
      console.error('Error updating thread timestamp:', threadError);
      // Don't throw here as message was sent successfully
    }

    console.log('Message sent successfully:', message);
    return message;
  } catch (error) {
    console.error('Detailed error sending message:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

/**
 * Updates message read status
 */
export const markMessageAsRead = async (messageId: string) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);

    if (error) throw error;
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

/**
 * Searches for users by username
 */
export const searchUsers = async (query: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`)
      .limit(10);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

/**
 * Updates a user's profile
 */
export const updateProfile = async (
  userId: string,
  updates: {
    username?: string;
    avatar_url?: string;
  }
) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

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
