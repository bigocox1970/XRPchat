import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../utils/supabase/client';
import { createProfile, createWallet } from '../utils/supabase/auth';
import { generateKeyPair } from '../utils/encryption';
import type { Database } from '../types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Wallet = Database['public']['Tables']['wallets']['Row'];

interface UserContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ privateKey: string; address: string }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: { username?: string; avatar_url?: string }) => Promise<void>;
  regenerateWallet: (privateKey: string, address: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        }

        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
              await fetchProfile(session.user.id);
            } else {
              setProfile(null);
              setWallet(null);
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile and wallet data for:', userId);
      
      // Reset state first to avoid stale data
      setProfile(null);
      setWallet(null);
      
      // Use maybeSingle instead of single to avoid errors when profile doesn't exist
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        throw profileError;
      }

      if (profile) {
        console.log('Profile fetched successfully:', profile);
        setProfile(profile);
        
        // Use maybeSingle for wallet too
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('profile_id', userId)
          .maybeSingle();

        if (walletError) {
          console.error('Error fetching wallet:', walletError);
          throw walletError;
        }
        
        console.log('Wallet fetched successfully:', wallet ? 'found' : 'not found');
        setWallet(wallet);
      } else {
        console.warn('No profile found for user:', userId);
        // Try with service role client as a fallback (has more permissions)
        try {
          const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
            
          if (adminProfileError) {
            console.error('Error fetching profile with admin client:', adminProfileError);
          } else if (adminProfile) {
            console.log('Profile fetched with admin client:', adminProfile);
            setProfile(adminProfile);
            
            const { data: adminWallet, error: adminWalletError } = await supabaseAdmin
              .from('wallets')
              .select('*')
              .eq('profile_id', userId)
              .maybeSingle();
              
            if (adminWalletError) {
              console.error('Error fetching wallet with admin client:', adminWalletError);
            } else {
              console.log('Wallet fetched with admin client:', adminWallet ? 'found' : 'not found');
              setWallet(adminWallet);
            }
          } else {
            console.warn('Profile not found even with admin client');
          }
        } catch (adminError) {
          console.error('Error using admin client:', adminError);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const signUp = async (email: string, password: string, username: string): Promise<{ privateKey: string; address: string }> => {
    try {
      console.log('Starting signup process...');

      // Check if username is already taken using count
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('username', username);

      if (countError) {
        console.error('Error checking username:', countError);
        throw countError;
      }

      if (count && count > 0) {
        throw new Error('Username is already taken');
      }

      console.log('Username is available, generating wallet...');

      // Generate wallet first to have the address ready
      const keyPair = await generateKeyPair();
      console.log('Wallet generated successfully');

      // Create auth user with email confirmation disabled
      console.log('Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            wallet_address: keyPair.address
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      // Log the complete auth response for debugging
      console.log('Auth response:', JSON.stringify(authData, null, 2));

      const userId = authData.user?.id;
      if (!userId) {
        console.error('No user ID after signup');
        throw new Error('No user ID after signup');
      }

      console.log('Auth user created, creating profile...');

      try {
        // Create profile using service role client
        await createProfile(userId, username, keyPair.address);
        console.log('Profile created successfully');
      } catch (profileError) {
        console.error('CRITICAL ERROR creating profile:', profileError);
        // Instead of just logging, we also throw this error to prevent success state
        throw new Error(`Profile creation failed: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`);
      }

      console.log('Profile created, creating wallet...');

      try {
        // Create wallet using service role client
        await createWallet(userId, keyPair.address, keyPair.publicKey, keyPair.privateKey);
        console.log('Wallet created successfully');
      } catch (walletError) {
        console.error('CRITICAL ERROR creating wallet:', walletError);
        // Instead of just logging, we also throw this error to prevent success state
        throw new Error(`Wallet creation failed: ${walletError instanceof Error ? walletError.message : 'Unknown error'}`);
      }

      // Add verification step to make sure profile is queryable
      try {
        console.log('Verifying profile creation...');
        // Use direct query with service role client to verify profile exists
        const { data: checkProfile, error: checkError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (checkError) {
          console.warn('Profile verification warning:', checkError);
        }
        
        if (!checkProfile) {
          console.warn('Profile verification could not find profile, waiting 2 seconds to retry...');
          // Wait a bit and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: retryProfile, error: retryError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
            
          if (retryError || !retryProfile) {
            console.warn('Profile still not found after retry, but continuing:', retryError);
          } else {
            console.log('Profile found after retry:', retryProfile);
          }
        } else {
          console.log('Profile verification successful:', checkProfile);
          // Manually set the profile state since we know it exists but might not be immediately available via normal channels
          setProfile(checkProfile);
          // Also set the wallet since we know it exists too
          const { data: verifiedWallet } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('profile_id', userId)
            .maybeSingle();
            
          if (verifiedWallet) {
            console.log('Wallet verification successful, updating state');
            setWallet(verifiedWallet);
          }
        }
      } catch (verifyError) {
        console.warn('Profile verification error (non-fatal):', verifyError);
        // Don't throw, as we've already created the profile and wallet
      }

      console.log('Signup completed successfully. Please check your email to confirm your account.');
      
      return {
        privateKey: keyPair.privateKey,
        address: keyPair.address
      };
    } catch (error) {
      console.error('Detailed signup error:', error);
      if (error instanceof Error) {
        throw new Error(`Signup failed: ${error.message}`);
      } else {
        throw new Error('An unexpected error occurred during sign up');
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const updateUserProfile = async (updates: { username?: string; avatar_url?: string }) => {
    try {
      if (!user?.id) throw new Error('No user ID');

      if (updates.username) {
        // Check if username is already taken using count
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('username', updates.username)
          .neq('id', user.id);

        if (countError) throw countError;
        if (count && count > 0) {
          throw new Error('Username is already taken');
        }
      }

      // Add updated_at timestamp
      const updatedData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile to get updated data
      console.log('Profile updated, fetching latest data');
      await fetchProfile(user.id);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // Don't render until we've initialized auth
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Initializing...</div>
      </div>
    );
  }

  const value = {
    session,
    user,
    profile,
    wallet,
    loading,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    regenerateWallet: async (privateKey: string, address: string) => {
      try {
        if (!user?.id) throw new Error('No user ID');

        // Update wallet in database
        const { error: walletError } = await supabase
          .from('wallets')
          .update({
            address: address,
            private_key: privateKey,
          })
          .eq('profile_id', user.id);

        if (walletError) throw walletError;

        // Update profile wallet address
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ wallet_address: address })
          .eq('id', user.id);

        if (profileError) throw profileError;

        // Refresh profile to get updated data
        await fetchProfile(user.id);
      } catch (error) {
        console.error('Error regenerating wallet:', error);
        throw error;
      }
    },
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// Replace the exported hook with a named function
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
