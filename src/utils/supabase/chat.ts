import { supabase } from './client';
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

    // Sort participant IDs to ensure consistent hashing
    const sortedParticipants = [...participantIds].sort();
    const msgUint8 = new TextEncoder().encode(sortedParticipants.join(','));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check for existing thread first
    const { data: existing } = await supabase
      .from('threads')
      .select('*')
      .eq('participant_hash', hash)
      .single();

    if (existing) return existing;

    // Create new thread if none exists
    const { data, error } = await supabase
      .from('threads')
      .insert({
        name,
        participant_ids: sortedParticipants,
        participant_hash: hash,
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
