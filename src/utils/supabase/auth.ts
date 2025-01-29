import { supabase, supabaseAdmin } from './client';

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
