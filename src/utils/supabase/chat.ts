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

    if (messageError) throw messageError;

      // Update thread's last_message_at
      const now = new Date().toISOString();
      await Promise.all([
        supabase
          .from('threads')
          .update({ last_message_at: now })
          .eq('id', threadId),
        supabase
          .from('profiles')
          .update({ last_active: now })
          .eq('id', senderId)
      ]);

    // Don't throw on update errors as message was sent successfully
    return { data: message };
  } catch (error) {
    throw error;
  }
};

/**
 * Updates message read status
 */
export const markMessageAsRead = async (messageId: string, userId: string) => {
  try {
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId),
      supabase
        .from('profiles')
        .update({ last_active: now })
        .eq('id', userId)
    ]);
  } catch (error) {
    throw error;
  }
};
