// Import supabase client
import { supabase } from './client';

export * from './client';
export * from './auth';
export * from './chat';
export * from './realtime';

// Re-export specific functions for easier imports
export { addContact, getContacts } from './auth';

// Add or modify the function to update the user's last_active timestamp
export const updateLastActive = async (userId: string) => {
  try {
    // Update the last_active timestamp to the current time
    const { error } = await supabase
      .from('profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating last_active status:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating last_active status:', error);
    return false;
  }
};

// Update the markMessageAsRead function to also update last_active
export const markMessageAsRead = async (messageId: string, userId: string) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);
      
    if (error) throw error;
    
    // Also update the user's last_active status
    updateLastActive(userId);
    
    return true;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
};
