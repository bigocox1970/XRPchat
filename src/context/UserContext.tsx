import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, createProfile, createWallet } from '../utils/supabase';
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
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: { username?: string; avatar_url?: string }) => Promise<void>;
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      if (profile) {
        setProfile(profile);
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('profile_id', userId)
          .single();

        if (walletError) throw walletError;
        setWallet(wallet);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
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

      const userId = authData.user?.id;
      if (!userId) {
        console.error('No user ID after signup');
        throw new Error('No user ID after signup');
      }

      console.log('Auth user created, creating profile...');

      // Create profile using service role client
      await createProfile(userId, username, keyPair.address);
      console.log('Profile created, creating wallet...');

      // Create wallet using service role client
      await createWallet(userId, keyPair.address, keyPair.publicKey, keyPair.privateKey);
      console.log('Signup completed successfully');

      // Auto sign in after signup
      await signIn(email, password);

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

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile
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
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
