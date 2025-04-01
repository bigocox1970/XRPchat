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
    // Sort participant IDs to ensure consistent hashing
    const sortedParticipants = [...participantIds].sort();
    const msgUint8 = new TextEncoder().encode(sortedParticipants.join(','));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check for existing thread first
    const { data: existing, error: queryError } = await supabase
      .from('threads')
      .select('*')
      .eq('participant_hash', hash)
      .maybeSingle();

    if (queryError) {
      console.warn('Error checking for existing thread:', queryError);
      // Continue to create a new thread anyway
    } else if (existing) {
      console.log('Found existing thread:', existing.id);
      return existing;
    }

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

    if (error) throw error;
    if (!data) throw new Error('Thread creation failed - no data returned');

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Gets all threads for a user
 */
export const getUserThreads = async (userId: string) => {
  try {
    console.log('Getting threads for user:', userId);
    
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

    if (error) {
      console.error('Error getting threads:', error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} threads for user`);
    return data || [];
  } catch (error) {
    console.error('Error in getUserThreads:', error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
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
    console.log('Getting messages for thread:', threadId, { limit, startFrom });
    
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

    if (error) {
      console.error('Error getting thread messages:', error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} messages in thread`);
    return data || [];
  } catch (error) {
    console.error('Error in getThreadMessages:', error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
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
    console.log('Sending message in thread:', threadId, 'by user:', senderId);
    
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

    console.log('Message inserted successfully:', message.id);

    // Update thread's last_message_at only, skip updating profiles for now
    const now = new Date().toISOString();
    
    try {
      // Update thread last_message_at
      const { error: threadError } = await supabase
        .from('threads')
        .update({ last_message_at: now })
        .eq('id', threadId);
        
      if (threadError) {
        console.warn('Non-critical error updating thread metadata:', threadError);
      } else {
        console.log('Thread last_message_at updated successfully');
      }
    } catch (threadError) {
      console.warn('Non-critical error updating thread:', threadError);
      // Don't throw as message was sent successfully
    }
    
    // Skip updating the last_active column for now since it might not exist
    console.log('Skipping last_active profile update until column is confirmed');

    return { data: message };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
};

/**
 * Updates message read status
 */
export const markMessageAsRead = async (messageId: string, userId: string) => {
  try {
    console.log('Marking message as read:', { messageId, userId });
    
    // Update message read status only
    try {
      const { error: readError } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);
        
      if (readError) {
        console.error('Error updating message read status:', readError);
      } else {
        console.log('Successfully marked message as read');
      }
    } catch (readErr) {
      console.error('Exception updating message read status:', readErr);
      // Don't throw as this is a non-critical operation
    }
    
    // Skip last_active update completely to avoid errors
    console.log('Skipping last_active profile update until column is confirmed to exist');
  } catch (error) {
    console.error('Error in markMessageAsRead operation:', error);
    // Don't throw as this is a non-critical operation
  }
};

/**
 * Deletes a thread and all its associated messages
 */
export const deleteThread = async (threadId: string, userId: string) => {
  try {
    console.log('Deleting thread:', threadId, 'for user:', userId);

    // First, get the thread to verify the user is a participant
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('participant_ids')
      .eq('id', threadId)
      .single();

    if (threadError) {
      console.error('Error getting thread for deletion:', threadError);
      throw new Error('Failed to verify thread ownership');
    }

    // Verify user is a participant in the thread
    if (!thread || !thread.participant_ids.includes(userId)) {
      console.error('User is not authorized to delete this thread');
      throw new Error('You are not authorized to delete this thread');
    }

    // Delete all messages in the thread
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('thread_id', threadId);

    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      throw new Error('Failed to delete messages');
    }

    console.log('Successfully deleted all messages in thread:', threadId);

    // Delete the thread itself
    const { error: deleteError } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId);

    if (deleteError) {
      console.error('Error deleting thread:', deleteError);
      throw new Error('Failed to delete thread');
    }

    console.log('Successfully deleted thread:', threadId);
    return { success: true };
  } catch (error) {
    console.error('Error in deleteThread:', error);
    throw error;
  }
};
