import { supabase } from './client';

// Auto-delete option types
type AutoDeleteTimeUnit = 'minutes' | 'hours' | 'days' | 'weeks';
type AutoDeleteOption = 'off' | '5min' | '30min' | '1hour' | '1day' | '1week' | 'custom';

/**
 * Auto-delete implementation for messages
 * 
 * Key changes:
 * - Messages are now deleted from both sides of the chat (for both participants)
 * - Auto-delete takes into account both users' settings, using the shorter time if both have it enabled
 * - If only one user has auto-delete enabled, their setting will apply to all messages in the thread
 */

interface AutoDeleteSettings {
  enabled: boolean;
  option: AutoDeleteOption;
  customValue: number;
  customUnit: AutoDeleteTimeUnit;
}

/**
 * Converts the auto-delete settings to milliseconds
 */
export const getAutoDeleteMilliseconds = (settings: AutoDeleteSettings): number | null => {
  if (!settings.enabled || settings.option === 'off') {
    return null;
  }

  let milliseconds = 0;
  
  switch (settings.option) {
    case '5min':
      milliseconds = 5 * 60 * 1000;
      break;
    case '30min':
      milliseconds = 30 * 60 * 1000;
      break;
    case '1hour':
      milliseconds = 60 * 60 * 1000;
      break;
    case '1day':
      milliseconds = 24 * 60 * 60 * 1000;
      break;
    case '1week':
      milliseconds = 7 * 24 * 60 * 60 * 1000;
      break;
    case 'custom':
      const value = settings.customValue;
      
      switch (settings.customUnit) {
        case 'minutes':
          milliseconds = value * 60 * 1000;
          break;
        case 'hours':
          milliseconds = value * 60 * 60 * 1000;
          break;
        case 'days':
          milliseconds = value * 24 * 60 * 60 * 1000;
          break;
        case 'weeks':
          milliseconds = value * 7 * 24 * 60 * 60 * 1000;
          break;
      }
      break;
  }
  
  return milliseconds;
};

/**
 * Gets the auto-delete settings from localStorage
 */
export const getAutoDeleteSettings = (): AutoDeleteSettings => {
  const defaultSettings: AutoDeleteSettings = {
    enabled: false,
    option: 'off',
    customValue: 24,
    customUnit: 'hours'
  };
  
  try {
    const savedSettings = localStorage.getItem('xrpchat_auto_delete_settings');
    if (savedSettings) {
      return JSON.parse(savedSettings) as AutoDeleteSettings;
    }
  } catch (e) {
    console.error('Error parsing auto-delete settings:', e);
  }
  
  return defaultSettings;
};

/**
 * Checks for and deletes expired messages based on the auto-delete settings
 * Modified to delete messages on both sides of the chat
 */
export const checkAndDeleteExpiredMessages = async (userId: string): Promise<number> => {
  try {
    // Get the current user's auto-delete settings
    const autoDeleteSettings = getAutoDeleteSettings();
    const autoDeleteMilliseconds = getAutoDeleteMilliseconds(autoDeleteSettings);
    
    // If auto-delete is disabled for the current user, we can still 
    // proceed to check threads where the other participant might have it enabled
    
    // First, get all threads the user is part of
    const { data: userThreads, error: threadsError } = await supabase
      .from('threads')
      .select('id, participant_ids')
      .contains('participant_ids', [userId]);
    
    if (threadsError) {
      console.error('Error fetching user threads:', threadsError);
      return 0; // No threads or error
    }
    
    if (!userThreads || userThreads.length === 0) {
      return 0; // No threads found
    }
    
    let totalDeleted = 0;
    
    // For each thread, check both participants' settings
    for (const thread of userThreads) {
      // Find the other participant's ID
      const otherParticipantId = thread.participant_ids.find((id: string) => id !== userId);
      
      if (!otherParticipantId) continue;
      
      // Get other user's settings
      const otherUserSettings = await getOtherUserAutoDeleteSettings(otherParticipantId);
      const otherUserMs = otherUserSettings ? getAutoDeleteMilliseconds(otherUserSettings) : null;
      
      // If neither user has auto-delete enabled, skip this thread
      if (!autoDeleteMilliseconds && !otherUserMs) continue;
      
      // Determine the shortest expiry time (most aggressive deletion policy)
      // If one user doesn't have auto-delete enabled, use the other user's setting
      let effectiveMs: number;
      
      if (autoDeleteMilliseconds && otherUserMs) {
        // Both users have auto-delete enabled, use the shorter timeframe
        effectiveMs = Math.min(autoDeleteMilliseconds, otherUserMs);
      } else {
        // Only one user has auto-delete enabled, use that setting
        effectiveMs = autoDeleteMilliseconds || otherUserMs || 0; // Default to 0 if somehow both are null (shouldn't happen)
      }
      
      // Calculate expiry time
      const now = new Date();
      const expiryTime = new Date(now.getTime() - effectiveMs);
      const expiryTimeISO = expiryTime.toISOString();
      
      // Query for messages in this thread that need to be deleted (older than the expiry time)
      const { data: messagesToDelete, error: queryError } = await supabase
        .from('messages')
        .select('id')
        .eq('thread_id', thread.id)
        .lt('created_at', expiryTimeISO);
      
      if (queryError) {
        console.error('Error querying expired messages for thread:', thread.id, queryError);
        continue;
      }
      
      if (!messagesToDelete || messagesToDelete.length === 0) {
        continue; // No messages to delete in this thread
      }
      
      // Get the IDs of messages to delete
      const messageIds = messagesToDelete.map(message => message.id);
      
      // Delete the expired messages
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .in('id', messageIds);
      
      if (deleteError) {
        console.error('Error deleting expired messages:', deleteError);
        continue;
      }
      
      console.log(`Deleted ${messageIds.length} expired messages from thread ${thread.id}`);
      totalDeleted += messageIds.length;
    }
    
    return totalDeleted;
  } catch (error) {
    console.error('Error in checkAndDeleteExpiredMessages:', error);
    return 0;
  }
};

/**
 * Schedules auto-deletion of messages
 * This function should be called when the app starts to set up the auto-delete interval
 */
export const setupAutoDeleteInterval = (userId: string | undefined) => {
  // Check and delete expired messages on startup
  if (userId) {
    checkAndDeleteExpiredMessages(userId).catch(error => {
      console.error('Error checking for expired messages on startup:', error);
    });
  }
  
  // Set up interval to check for expired messages every 5 minutes
  const interval = setInterval(() => {
    if (userId) {
      checkAndDeleteExpiredMessages(userId).catch(error => {
        console.error('Error checking for expired messages:', error);
      });
    }
  }, 5 * 60 * 1000);
  
  // Return a cleanup function that clears the interval
  return () => clearInterval(interval);
};

/**
 * Gets another user's auto-delete settings from the database
 * Returns null if the user has no auto-delete settings
 */
export const getOtherUserAutoDeleteSettings = async (userId: string): Promise<AutoDeleteSettings | null> => {
  try {
    // Query the database for user's auto-delete settings
    const { data, error } = await supabase
      .from('profiles')
      .select('auto_delete_settings')
      .eq('id', userId)
      .single();
      
    if (error || !data || !data.auto_delete_settings) {
      return null;
    }
    
    // Parse the settings
    try {
      return JSON.parse(data.auto_delete_settings) as AutoDeleteSettings;
    } catch (e) {
      console.error('Error parsing auto-delete settings from database:', e);
      return null;
    }
  } catch (error) {
    console.error('Error fetching other user auto-delete settings:', error);
    return null;
  }
};

/**
 * Saves the current user's auto-delete settings to the database so other users can see them
 */
export const saveAutoDeleteSettingsToDatabase = async (userId: string, settings: AutoDeleteSettings): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        auto_delete_settings: JSON.stringify(settings),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (error) {
      console.error('Error saving auto-delete settings to database:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveAutoDeleteSettingsToDatabase:', error);
    return false;
  }
};

/**
 * Loads auto-delete settings from the database for the current user
 * Call this function when a user logs in to restore their saved settings
 */
export const loadAutoDeleteSettingsFromDatabase = async (userId: string): Promise<boolean> => {
  try {
    // Fetch the user's settings from the database
    const { data, error } = await supabase
      .from('profiles')
      .select('auto_delete_settings')
      .eq('id', userId)
      .single();
      
    if (error || !data || !data.auto_delete_settings) {
      console.log('No auto-delete settings found in database for user:', userId);
      return false;
    }
    
    // Parse the settings
    try {
      const settings = JSON.parse(data.auto_delete_settings) as AutoDeleteSettings;
      
      // Save to localStorage
      localStorage.setItem('xrpchat_auto_delete_settings', JSON.stringify(settings));
      console.log('Loaded auto-delete settings from database:', settings);
      return true;
    } catch (e) {
      console.error('Error parsing auto-delete settings from database:', e);
      return false;
    }
  } catch (error) {
    console.error('Error loading auto-delete settings from database:', error);
    return false;
  }
}; 