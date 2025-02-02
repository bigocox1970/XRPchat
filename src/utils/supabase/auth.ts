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
    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username,
        wallet_address: walletAddress,
        last_active: new Date().toISOString()
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
 * Updates a user's profile
 */
export const updateProfile = async (
  userId: string,
  updates: {
    username?: string;
    avatar_url?: string;
    last_active?: string;
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
    
    // Update last_active for both users
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('profiles')
        .update({ last_active: now })
        .eq('id', user.id),
      supabase
        .from('profiles')
        .update({ last_active: now })
        .eq('id', contactId)
    ]);

    const { error, data } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        contact_id: contactId
      });

    if (error) {
      console.error('Supabase error adding contact:', {
        error: JSON.stringify(error, null, 2),
        data
      });
      if (error.code === '42P01') {
        throw new Error('Contacts table does not exist. Please run the migration first.');
      } else if (error.code === '23505' || error.code === '409') {
        throw new Error('You are already connected with this contact');
      } else if (error.code === '23503') {
        throw new Error('Invalid contact. User may not exist.');
      } else {
        throw new Error('Failed to add contact. Please try again.');
      }
    }
  } catch (error) {
    console.error('Error adding contact:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to add contact');
  }
};

/**
 * Gets a user's contacts
 */
export const getContacts = async (): Promise<Database['public']['Tables']['profiles']['Row'][]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Get contact IDs first
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('contact_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

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

    // Get profiles for contacts
    const contactIds = contactsData.map(c => c.contact_id);
    if (contactIds.length === 0) return [];

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', contactIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    if (!profilesData) return [];

    // Return the profiles data
    return profilesData;
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
      updated_at: profile.updated_at,
      last_active: profile.last_active
    }));
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};
