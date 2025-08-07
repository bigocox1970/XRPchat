import { gun } from './client';
import { getCurrentGunUser, updateLastActive } from './auth';

export interface GunMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_public_key: string;
  recipient_public_key: string;
  content: string; // Encrypted message content
  type: 'text' | 'image' | 'file';
  created_at: string;
  read: boolean;
  encrypted: boolean;
}

export interface GunThread {
  id: string;
  name: string;
  participant_ids: string[];
  participant_hash: string;
  created_by: string;
  created_at: string;
  last_message_at: string;
}

/**
 * Create a new thread between participants
 */
export const createGunThread = async (
  name: string,
  participantIds: string[],
  createdBy: string
): Promise<GunThread> => {
  try {
    // Sort participant IDs to ensure consistent hashing
    const sortedParticipants = [...participantIds].sort();
    const msgUint8 = new TextEncoder().encode(sortedParticipants.join(','));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const participantHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if thread already exists
    const existingThread = await new Promise<GunThread | null>((resolve) => {
      gun.get('threads').get(participantHash).once((thread: GunThread) => {
        resolve(thread || null);
      });
    });

    if (existingThread) {
      console.log('Found existing thread:', existingThread.id);
      return existingThread;
    }

    // Create new thread
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newThread: GunThread = {
      id: threadId,
      name,
      participant_ids: sortedParticipants,
      participant_hash: participantHash,
      created_by: createdBy,
      created_at: now,
      last_message_at: now
    };

    // Store thread by hash for easy lookup
    gun.get('threads').get(participantHash).put(newThread);
    
    // Also store thread by ID for direct access
    gun.get('thread').get(threadId).put(newThread);

    // Add thread to each participant's thread list
    sortedParticipants.forEach(participantId => {
      gun.get('user_threads').get(participantId).get(threadId).put({
        thread_id: threadId,
        participant_hash: participantHash,
        added_at: now
      });
    });

    return newThread;
  } catch (error) {
    console.error('Error creating Gun thread:', error);
    throw error;
  }
};

/**
 * Get all threads for a user
 */
export const getUserGunThreads = async (userId: string): Promise<GunThread[]> => {
  return new Promise((resolve) => {
    const threads: GunThread[] = [];
    const threadIds = new Set<string>();

    gun.get('user_threads').get(userId).map().once((threadRef: any, key: string) => {
      if (threadRef && threadRef.thread_id && !threadIds.has(threadRef.thread_id)) {
        threadIds.add(threadRef.thread_id);
        
        // Get the actual thread data
        gun.get('thread').get(threadRef.thread_id).once((thread: GunThread) => {
          if (thread) {
            threads.push(thread);
          }
        });
      }
    });

    // Give Gun time to load all threads
    setTimeout(() => {
      resolve(threads.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      ));
    }, 1500);
  });
};

/**
 * Get messages for a thread
 */
export const getGunThreadMessages = async (
  threadId: string,
  limit = 50
): Promise<GunMessage[]> => {
  return new Promise((resolve) => {
    const messages: GunMessage[] = [];

    gun.get('thread_messages').get(threadId).map().once((message: GunMessage) => {
      if (message && message.id) {
        messages.push(message);
      }
    });

    // Give Gun time to load all messages
    setTimeout(() => {
      resolve(
        messages
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit)
      );
    }, 1000);
  });
};

/**
 * Send a message in a thread
 */
export const sendGunMessage = async (
  threadId: string,
  senderId: string,
  senderPublicKey: string,
  recipientPublicKey: string,
  encryptedContent: string,
  type: 'text' | 'image' | 'file' = 'text'
): Promise<GunMessage> => {
  try {
    const currentUser = getCurrentGunUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const message: GunMessage = {
      id: messageId,
      thread_id: threadId,
      sender_id: senderId,
      sender_public_key: senderPublicKey,
      recipient_public_key: recipientPublicKey,
      content: encryptedContent,
      type,
      created_at: now,
      read: false,
      encrypted: true
    };

    // Store message in thread messages
    gun.get('thread_messages').get(threadId).get(messageId).put(message);

    // Store message by ID for direct access
    gun.get('message').get(messageId).put(message);

    // Update thread's last message time
    gun.get('thread').get(threadId).get('last_message_at').put(now);

    // Update sender's last active time
    updateLastActive();

    console.log('Message sent successfully:', messageId);
    return message;
  } catch (error) {
    console.error('Error sending Gun message:', error);
    throw error;
  }
};

/**
 * Mark a message as read
 */
export const markGunMessageAsRead = async (messageId: string, userId: string): Promise<void> => {
  try {
    gun.get('message').get(messageId).get('read').put(true);
    updateLastActive();
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

/**
 * Delete a thread and its messages
 */
export const deleteGunThread = async (threadId: string, userId: string): Promise<void> => {
  try {
    // Get thread to verify user is participant
    const thread = await new Promise<GunThread | null>((resolve) => {
      gun.get('thread').get(threadId).once((thread: GunThread) => {
        resolve(thread || null);
      });
    });

    if (!thread || !thread.participant_ids.includes(userId)) {
      throw new Error('You are not authorized to delete this thread');
    }

    // Delete all messages in the thread
    gun.get('thread_messages').get(threadId).map().once((message: any, key: string) => {
      if (message) {
        gun.get('thread_messages').get(threadId).get(key).put(null);
        gun.get('message').get(key).put(null);
      }
    });

    // Remove thread from participants' thread lists
    thread.participant_ids.forEach(participantId => {
      gun.get('user_threads').get(participantId).get(threadId).put(null);
    });

    // Delete the thread itself
    gun.get('thread').get(threadId).put(null);
    gun.get('threads').get(thread.participant_hash).put(null);

    console.log('Thread deleted successfully:', threadId);
  } catch (error) {
    console.error('Error deleting Gun thread:', error);
    throw error;
  }
};

/**
 * Get message routing information for offline users
 */
export const getMessageRoute = (recipientPublicKey: string) => {
  // In Gun.js, messages are stored by thread and accessible to all participants
  // No specific routing needed as Gun handles P2P synchronization
  return {
    route: `recipient_${recipientPublicKey}`,
    stored: true,
    p2p: true
  };
};

/**
 * Queue message for offline recipient
 */
export const queueMessageForOfflineUser = async (
  recipientPublicKey: string,
  message: GunMessage
): Promise<void> => {
  try {
    // Store message in recipient's inbox for when they come online
    gun.get('inbox').get(recipientPublicKey).get(message.id).put(message);
    
    console.log('Message queued for offline user:', recipientPublicKey);
  } catch (error) {
    console.error('Error queuing message:', error);
    throw error;
  }
};

/**
 * Get queued messages for current user
 */
export const getQueuedMessages = async (userPublicKey: string): Promise<GunMessage[]> => {
  return new Promise((resolve) => {
    const messages: GunMessage[] = [];

    gun.get('inbox').get(userPublicKey).map().once((message: GunMessage) => {
      if (message && message.id) {
        messages.push(message);
        // Clear message from inbox once retrieved
        gun.get('inbox').get(userPublicKey).get(message.id).put(null);
      }
    });

    setTimeout(() => resolve(messages), 1000);
  });
};