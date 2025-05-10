import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

console.log('[DEBUG] Supabase URL:', supabaseUrl);
console.log('[DEBUG] Supabase Anon Key:', supabaseAnonKey ? supabaseAnonKey.substring(0, 8) + '...' : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or anon key is missing');
}

// Client for authenticated and anonymous operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use localStorage on desktop and mobile to improve compatibility
    storage: isBrowser ? window.localStorage : undefined,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey
    },
    fetch: (input, init = {}) => {
      // Always use cache: 'no-store' for all requests
      return fetch(input, { ...init, cache: 'no-store' });
    }
  }
});

console.log('[DEBUG] Supabase client created:', !!supabase);

// Admin client for operations that require service role
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey || supabaseAnonKey,
      'Authorization': `Bearer ${supabaseServiceKey || supabaseAnonKey}`,
    },
    fetch: (input, init = {}) => {
      // Always use cache: 'no-store' for all requests
      return fetch(input, { ...init, cache: 'no-store' });
    }
  }
});

// Run the last_active migration
export const runLastActiveMigration = async () => {
  if (!supabaseServiceKey) {
    console.warn('Service key not available, skipping migration');
    return { success: false, error: 'No service key' };
  }

  try {
    console.log('Attempting to run last_active column migration...');
    
    // Check if column exists first
    const { error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('last_active')
      .limit(1);
      
    if (!checkError) {
      console.log('last_active column already exists, skipping migration');
      return { success: true, alreadyExists: true };
    }
    
    // Add last_active column if it doesn't exist
    const { error: columnError } = await supabaseAdmin.rpc('add_last_active_column');
    if (columnError) {
      console.error('Error adding last_active column:', columnError);
      return { success: false, error: columnError };
    }
    
    // Create function to update last_active
    const { error: functionError } = await supabaseAdmin.rpc('create_update_last_active_function');
    if (functionError) {
      console.error('Error creating last_active function:', functionError);
      return { success: false, error: functionError };
    }
    
    // Create trigger to update last_active when user sends a message
    const { error: triggerError } = await supabaseAdmin.rpc('create_update_last_active_trigger');
    if (triggerError) {
      console.error('Error creating last_active trigger:', triggerError);
      return { success: false, error: triggerError };
    }
    
    console.log('Successfully completed last_active migration');
    return { success: true };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
};

// Validate admin client on initialization - but don't try to count profiles
// which seems to be causing a 400 error
(async () => {
  if (!supabaseServiceKey) {
    return; // Already logged warning above
  }
  
  try {
    // Simple test query to verify service role permissions using a simple table query
    // instead of count(*) which might be failing due to RLS policies
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    
    if (error) {
      console.error('CRITICAL: Supabase service role validation failed:', error);
      // Don't throw as this would crash app initialization
    } else {
      console.log('Supabase service role key validated successfully');
      
      // FOR NOW, let's skip the migration as the RPC functions don't seem to exist
      console.log('Skipping last_active migration since RPC functions aren\'t configured');
      
      // Instead, let's check if the last_active column exists directly
      try {
        const { data, error: structureError } = await supabaseAdmin
          .from('profiles')
          .select('last_active')
          .limit(1);
          
        if (structureError) {
          console.warn('last_active column likely doesn\'t exist:', structureError.message);
          console.warn('You may need to manually add this column to your Supabase profiles table');
          console.warn('Use this SQL command in Supabase\'s SQL editor:');
          console.warn('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();');
        } else {
          console.log('last_active column appears to exist already');
        }
      } catch (columnCheckError) {
        console.error('Error checking for last_active column:', columnCheckError);
      }
    }
  } catch (err) {
    console.error('Error validating Supabase service role:', err);
  }
})();

// Export a utility to check authentication status that's mobile friendly
export const checkAuthStatus = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error checking auth status:', error.message);
      return { isAuthenticated: false, error: error.message };
    }
    return { 
      isAuthenticated: !!data.session, 
      user: data.session?.user,
      expiresAt: data.session?.expires_at
    };
  } catch (err) {
    console.error('Unexpected error checking auth:', err);
    return { isAuthenticated: false, error: 'Unexpected error checking authentication' };
  }
};
