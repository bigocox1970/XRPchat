-- Migration: Add auto-delete functionality to XRPChat
-- Purpose: Adds auto_delete_settings column to profiles table and creates necessary triggers
-- Date: Created on: 2023-11-07

-- Step 1: Add auto_delete_settings column if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_delete_settings JSONB DEFAULT NULL;

-- Step 2: Add helpful comment to explain the column
COMMENT ON COLUMN public.profiles.auto_delete_settings IS 'JSON object containing user auto-delete message settings';

-- Step 3: Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the trigger to automatically update the timestamp when changes occur
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();

-- Step 5: Create an index on the auto_delete_settings column for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_auto_delete_settings ON public.profiles USING GIN (auto_delete_settings);

-- Step 6: Create or update the RLS (Row Level Security) policies
DO $$
BEGIN
    -- Check if the policy exists
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can update their own profile.'
    ) THEN
        -- If it exists, alter it
        ALTER POLICY "Users can update their own profile." 
        ON public.profiles 
        USING (auth.uid() = id) 
        WITH CHECK (auth.uid() = id);
    ELSE
        -- If it doesn't exist, create it
        CREATE POLICY "Users can update their own profile."
        ON public.profiles
        FOR ALL
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

-- Step 7: Add last_active column if it doesn't exist for tracking user online status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NULL;
COMMENT ON COLUMN public.profiles.last_active IS 'Timestamp of when the user was last active in the app';

-- Display completion message (this won't actually show in Supabase console but serves as documentation)
DO $$
BEGIN
  RAISE NOTICE 'Auto-delete settings migration completed successfully';
END
$$; 