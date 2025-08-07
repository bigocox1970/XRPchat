import { gun, SEA } from './client';
import { generateKeyPair } from '../encryption';

export interface GunUser {
  publicKey: string;
  privateKey?: string;
  address: string;
  username: string;
  avatar_url?: string;
  avatar_seed?: string;
  auto_delete_settings?: any;
  last_active?: string;
  contacts?: string[];
}

export interface GunProfile {
  id: string;
  username: string;
  address: string;
  avatar_url?: string;
  avatar_seed?: string;
  auto_delete_settings?: any;
  last_active?: string;
  created_at: string;
}

// Current user instance
let currentUser: any = null;
let currentProfile: GunProfile | null = null;

/**
 * Create a new user account with XRP wallet
 */
export const createGunUser = async (username: string, xrpPrivateKey?: string, xrpAddress?: string) => {
  try {
    // Generate XRP wallet if not provided
    let privateKey = xrpPrivateKey;
    let address = xrpAddress;
    
    if (!privateKey || !address) {
      const wallet = await generateKeyPair();
      privateKey = wallet.privateKey;
      address = wallet.address;
    }

    // Create Gun user using XRP address as username
    const alias = address;
    // Ensure password meets Gun.js minimum length requirement (typically 8+ chars)
    const pass = (privateKey && privateKey.length >= 8) ? privateKey : (privateKey || '') + '00000000'.slice(0, 8 - (privateKey || '').length);

    // Create Gun user account
    const user = await new Promise<any>((resolve, reject) => {
      gun.user().create(alias, pass, (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve(gun.user());
        }
      });
    });

    // Authenticate immediately after creation
    await authenticateGunUser(alias, pass);

    // Create profile
    const profile: GunProfile = {
      id: address,
      username,
      address,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      auto_delete_settings: { enabled: false, duration: 24 }
    };

    // Store profile in Gun
    currentUser.get('profile').put(profile);
    currentProfile = profile;

    return {
      user,
      profile,
      privateKey,
      address
    };
  } catch (error) {
    console.error('Error creating Gun user:', error);
    throw error;
  }
};

/**
 * Authenticate user with XRP credentials
 */
export const authenticateGunUser = async (address: string, privateKey: string): Promise<GunUser> => {
  return new Promise((resolve, reject) => {
    // Ensure password meets Gun.js minimum length requirement
    const pass = (privateKey && privateKey.length >= 8) ? privateKey : (privateKey || '') + '00000000'.slice(0, 8 - (privateKey || '').length);
    gun.user().auth(address, pass, (ack: any) => {
      if (ack.err) {
        reject(new Error(ack.err));
      } else {
        currentUser = gun.user();
        
        // Load profile
        currentUser.get('profile').once((profile: GunProfile) => {
          if (profile) {
            currentProfile = profile;
          }
        });

        resolve({
          publicKey: ack.pub,
          privateKey,
          address,
          username: currentProfile?.username || 'Unknown',
          avatar_url: currentProfile?.avatar_url,
          avatar_seed: currentProfile?.avatar_seed,
          auto_delete_settings: currentProfile?.auto_delete_settings,
          last_active: new Date().toISOString()
        });
      }
    });
  });
};

/**
 * Sign out current user
 */
export const signOutGunUser = () => {
  if (currentUser) {
    currentUser.leave();
    currentUser = null;
    currentProfile = null;
  }
};

/**
 * Get current user
 */
export const getCurrentGunUser = () => currentUser;

/**
 * Get current profile
 */
export const getCurrentProfile = () => currentProfile;

/**
 * Update user profile
 */
export const updateGunProfile = async (updates: Partial<GunProfile>) => {
  if (!currentUser || !currentProfile) {
    throw new Error('No authenticated user');
  }

  const updatedProfile = {
    ...currentProfile,
    ...updates,
    last_active: new Date().toISOString()
  };

  currentUser.get('profile').put(updatedProfile);
  currentProfile = updatedProfile;

  return updatedProfile;
};

// Contact functions moved to contacts.ts to avoid duplication

/**
 * Find user by XRP address
 */
export const findGunUserByAddress = async (address: string): Promise<GunProfile | null> => {
  return new Promise((resolve) => {
    gun.get(`~${address}`).get('profile').once((profile: GunProfile) => {
      resolve(profile || null);
    });
  });
};

/**
 * Update last active timestamp
 */
export const updateLastActive = async () => {
  if (currentUser && currentProfile) {
    const timestamp = new Date().toISOString();
    currentUser.get('profile').get('last_active').put(timestamp);
    if (currentProfile) {
      currentProfile.last_active = timestamp;
    }
  }
};