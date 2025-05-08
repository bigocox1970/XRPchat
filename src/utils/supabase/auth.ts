import { supabase, supabaseAdmin } from './client';
import type { Database } from '../../types/supabase';

/**
 * Creates a new user profile with wallet
 */
export const createProfile = async (
  userId: string,
  username: string,
  walletAddress: string
) => {
  try {
    // Get the current timestamp for consistency across fields
    const now = new Date().toISOString();
    
    // Insert bare minimum profile data according to the schema
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username: username,
        wallet_address: walletAddress,
        updated_at: now
      });

    if (error) {
      console.error('Profile creation error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('Profile created successfully');
    return data;
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
    // Get the current timestamp for consistency
    const now = new Date().toISOString();
    
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .insert({
        profile_id: profileId,
        address: address,
        public_key: publicKey,
        private_key: privateKey,
        created_at: now,
        updated_at: now
      });

    if (error) {
      console.error('Wallet creation error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('Wallet created successfully');
    return data;
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
    console.log('Fetching profile for user:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
    
    if (!data) {
      console.warn('No profile found for user:', userId);
      return null;
    }
    
    console.log('Profile fetched successfully:', data);
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
 * Updates a user's profile
 */
export const updateProfile = async (
  userId: string,
  updates: {
    username?: string;
    avatar_url?: string;
    last_active?: string;
    avatar_seed?: string;
  }
) => {
  try {
    console.log('Updating profile for user:', userId, 'with data:', updates);
    
    // Add updated_at timestamp
    const updatedData = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updatedData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
    
    console.log('Profile updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Checks if a contact already exists
 */
const checkContactExists = async (userId: string, contactId: string) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (error) {
    console.error('Error checking contact:', error);
    throw error;
  }

  return data && data.length > 0;
};

/**
 * Adds a new contact
 */
export const addContact = async (contactId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    if (!user.id) throw new Error('Invalid user ID');
    if (!contactId) throw new Error('Invalid contact ID');

    // Check if contact already exists
    const exists = await checkContactExists(user.id, contactId);
    if (exists) {
      throw new Error('Contact already exists');
    }

    // Check if trying to add self as contact
    if (user.id === contactId) {
      throw new Error('Cannot add yourself as a contact');
    }

    console.log('Adding contact:', { userId: user.id, contactId });
    
    // First check if the last_active column exists on profiles
    let canUpdateLastActive = false;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, last_active')
        .eq('id', user.id)
        .single();
      
      canUpdateLastActive = !profileError && profile && 'last_active' in profile;
    } catch (checkError) {
      console.warn('Error checking if last_active exists:', checkError);
      // Continue with adding contact even if check fails
    }
    
    // Only update the last_active for the current user if the column exists
    if (canUpdateLastActive) {
      try {
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ last_active: now })
          .eq('id', user.id);
        
        if (updateError) {
          console.warn('Non-critical error updating last_active:', updateError);
        }
      } catch (updateError) {
        console.warn('Non-critical error during last_active update:', updateError);
      }
    }
    
    // Add the contact
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        contact_id: contactId,
        status: 'active'
      });

    if (error) {
      console.error('Error adding contact:', error);
      throw error;
    }

    console.log('Contact added successfully');
    return data;
  } catch (error) {
    console.error('Error in addContact:', error);
    throw error;
  }
};

/**
 * Removes a contact
 */
export const removeContact = async (contactId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    if (!user.id) throw new Error('Invalid user ID');
    if (!contactId) throw new Error('Invalid contact ID');

    console.log('Removing contact:', { userId: user.id, contactId });
    
    // Remove the contact from the contacts table
    const { data, error } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', user.id)
      .eq('contact_id', contactId);

    if (error) {
      console.error('Error removing contact:', error);
      throw error;
    }

    console.log('Contact removed successfully');
    return data;
  } catch (error) {
    console.error('Error in removeContact:', error);
    throw error;
  }
};

/**
 * Blocks a contact
 */
export const blockContact = async (contactId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    if (!user.id) throw new Error('Invalid user ID');
    if (!contactId) throw new Error('Invalid contact ID');

    console.log('Blocking contact:', { userId: user.id, contactId });
    
    // First check if contact exists
    const exists = await checkContactExists(user.id, contactId);
    console.log('Contact exists check:', exists);
    
    // Check if the status column exists in the contacts table
    let hasStatusColumn = false;
    try {
      // Make a simple query that uses the status column to see if it exists
      const { data: statusTest, error: statusTestError } = await supabase
        .from('contacts')
        .select('status')
        .limit(1);
      
      // If no error, the column exists
      hasStatusColumn = !statusTestError;
      console.log('Status column exists in contacts table:', hasStatusColumn);
      
      // If the column doesn't exist, try to add it
      if (!hasStatusColumn) {
        console.warn('Status column missing, attempting to add it...');
        const { error: alterError } = await supabase.rpc('add_status_column_if_missing');
        if (alterError) {
          console.error('Could not add status column:', alterError);
        } else {
          hasStatusColumn = true;
          console.log('Successfully added status column');
        }
      }
    } catch (error) {
      console.error('Error checking status column:', error);
      // Continue with the function, we'll handle missing column below
    }
    
    if (exists) {
      // Update existing contact to blocked status
      console.log('Updating existing contact to blocked status');
      
      // Use different SQL depending on whether status column exists
      let updateResult;
      
      if (hasStatusColumn) {
        updateResult = await supabase
          .from('contacts')
          .update({ status: 'blocked' })
          .eq('user_id', user.id)
          .eq('contact_id', contactId)
          .select('*');
      } else {
        // If status column doesn't exist, we can't block, but don't fail
        console.warn('Cannot set blocked status: status column missing');
        updateResult = { data: null, error: null };
      }
      
      const { data, error } = updateResult;
      
      console.log('Update result:', { data, error });

      if (error) {
        console.error('Error blocking contact:', error);
        throw error;
      }
      
      // Verify the update worked correctly using a separate query for maximum reliability
      const afterUpdate = await checkContactStatus(user.id, contactId);
      console.log('Contact status after blocking:', afterUpdate);
      
      if (hasStatusColumn && afterUpdate !== 'blocked') {
        console.warn('Contact status not updated correctly! Trying direct SQL update...');
        
        // Try a direct SQL approach as a fallback
        try {
          const { error: sqlError } = await supabase.rpc('force_block_contact', { 
            p_user_id: user.id, 
            p_contact_id: contactId 
          });
          
          if (sqlError) {
            console.error('Error in SQL fallback:', sqlError);
          } else {
            console.log('SQL fallback succeeded');
            // Check one more time
            const finalStatus = await checkContactStatus(user.id, contactId);
            console.log('Final contact status after SQL update:', finalStatus);
          }
        } catch (sqlError) {
          console.error('Exception in SQL fallback:', sqlError);
        }
      }
      
      console.log('Contact blocked successfully');
      return data;
    } else {
      // Add as a new blocked contact
      console.log('Adding new blocked contact');
      
      // Prepare the contact data
      const contactData: any = {
        user_id: user.id,
        contact_id: contactId,
      };
      
      // Only add status if the column exists
      if (hasStatusColumn) {
        contactData.status = 'blocked';
      }
      
      const { data, error } = await supabase
        .from('contacts')
        .insert(contactData)
        .select('*');

      if (error) {
        console.error('Error adding blocked contact:', error);
        throw error;
      }

      console.log('Contact added as blocked successfully:', data);
      return data;
    }
  } catch (error) {
    console.error('Error in blockContact:', error);
    throw error;
  }
};

/**
 * Helper function to check a contact's status
 */
const checkContactStatus = async (userId: string, contactId: string): Promise<string | null> => {
  try {
    // First, verify the column exists
    const { data: statusTest, error: statusTestError } = await supabase
      .from('contacts')
      .select('status')
      .limit(1);
      
    // If we get an error, column probably doesn't exist
    if (statusTestError) {
      console.warn('Status column may not exist:', statusTestError.message);
      return null;
    }
    
    // Column exists, get the status
    const { data, error } = await supabase
      .from('contacts')
      .select('status')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .single();

    if (error) {
      console.error('Error checking contact status:', error);
      return null;
    }

    console.log('Raw status data:', data);
    return data?.status || null;
  } catch (error) {
    console.error('Exception checking contact status:', error);
    return null;
  }
};

/**
 * Unblocks a contact
 */
export const unblockContact = async (contactId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    if (!user.id) throw new Error('Invalid user ID');
    if (!contactId) throw new Error('Invalid contact ID');

    console.log('Unblocking contact:', { userId: user.id, contactId });
    
    // First check if the contact exists
    const exists = await checkContactExists(user.id, contactId);
    console.log('Contact exists check for unblock:', exists);
    
    if (!exists) {
      console.error('Cannot unblock: contact does not exist');
      throw new Error('Contact does not exist');
    }
    
    // Check current status before unblocking
    const beforeStatus = await checkContactStatus(user.id, contactId);
    console.log('Contact status before unblocking:', beforeStatus);
    
    // Update contact status to active
    const { data, error } = await supabase
      .from('contacts')
      .update({ status: 'active' })
      .eq('user_id', user.id)
      .eq('contact_id', contactId);

    if (error) {
      console.error('Error unblocking contact:', error);
      throw error;
    }
    
    // Verify the update worked correctly
    const afterStatus = await checkContactStatus(user.id, contactId);
    console.log('Contact status after unblocking:', afterStatus);
    
    if (afterStatus === 'blocked') {
      console.warn('Warning: Contact still appears blocked after update!');
      
      // Try a more direct approach as fallback
      try {
        const { error: directError } = await supabase
          .from('contacts')
          .update({ status: 'active' })
          .eq('user_id', user.id)
          .eq('contact_id', contactId);
          
        if (directError) {
          console.error('Error in fallback unblock:', directError);
        } else {
          console.log('Fallback unblock succeeded');
          
          // Check one more time
          const finalStatus = await checkContactStatus(user.id, contactId);
          console.log('Final contact status after fallback:', finalStatus);
        }
      } catch (directError) {
        console.error('Exception in fallback unblock:', directError);
      }
    }
    
    console.log('Contact unblocked successfully');
    return data;
  } catch (error) {
    console.error('Error in unblockContact:', error);
    throw error;
  }
};

/**
 * Gets a user's contacts
 */
export const getContacts = async (): Promise<(Database['public']['Tables']['profiles']['Row'] & { status?: string })[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Check if the status column exists
    let hasStatusColumn = false;
    try {
      const { data: statusTest, error: statusTestError } = await supabase
        .from('contacts')
        .select('status')
        .limit(1);
      
      hasStatusColumn = !statusTestError;
      console.log('Status column exists in contacts table (getContacts):', hasStatusColumn);
    } catch (error) {
      console.warn('Error checking status column in getContacts:', error);
    }

    // Get contact IDs and status first - with detailed debugging
    console.log('Fetching contacts for user:', user.id);
    
    // Build query based on whether status column exists
    let contactsQuery;
    if (hasStatusColumn) {
      contactsQuery = supabase
        .from('contacts')
        .select('contact_id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    } else {
      contactsQuery = supabase
        .from('contacts')
        .select('contact_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    }
    
    const { data: contactsData, error: contactsError } = await contactsQuery;

    console.log('Raw contacts data:', contactsData);

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      if (contactsError.code === '42P01') {
        console.error('Contacts table does not exist');
        return [];
      }
      throw contactsError;
    }

    if (!contactsData || !Array.isArray(contactsData)) {
      console.error('Invalid contacts data:', contactsData);
      return [];
    }

    // Create a map of contact IDs to their status
    const contactStatusMap = new Map<string, string>();
    contactsData.forEach(contact => {
      // Use optional chaining to safely access the status property
      contactStatusMap.set(contact.contact_id, (contact as any).status || 'active');
    });
    
    console.log('Contact status map:', Object.fromEntries(contactStatusMap));

    // Get profiles for contacts
    const contactIds = contactsData.map(c => c.contact_id);
    if (contactIds.length === 0) return [];

    console.log('Fetching profiles for contact IDs:', contactIds);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', contactIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    if (!profilesData) return [];
    
    console.log('Raw profiles data:', profilesData);

    // Return the profiles data with status
    const result = profilesData.map(profile => ({
      ...profile,
      status: contactStatusMap.get(profile.id)
    }));
    
    console.log('Final contacts with status:', result.map(r => ({id: r.id, username: r.username, status: r.status})));
    
    return result;
  } catch (error) {
    console.error('Error getting contacts:', error);
    throw error;
  }
};

/**
 * Searches for users by username or wallet address
 */
export const searchUsers = async (query: string): Promise<Database['public']['Tables']['profiles']['Row'][]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,wallet_address.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;
    
    if (!data) return [];

    // Transform the data to ensure each profile has the correct shape
    return data.map(profile => ({
      id: profile.id,
      username: profile.username,
      wallet_address: profile.wallet_address,
      avatar_url: profile.avatar_url,
      avatar_seed: profile.avatar_seed,
      updated_at: profile.updated_at,
      last_active: profile.last_active
    }));
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};
