-- Add avatar_seed column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- Create or update RLS policies for the profiles table
-- First, check if the policy exists before trying to alter it
DO $$
BEGIN
    -- Try to create the public viewing policy if it doesn't exist
    BEGIN
        CREATE POLICY "Public profiles are viewable by everyone." ON profiles
        FOR SELECT USING (true);
    EXCEPTION WHEN duplicate_object THEN
        -- Policy already exists, so we don't need to do anything
        RAISE NOTICE 'Policy "Public profiles are viewable by everyone." already exists';
    END;

    -- Try to create the update policy if it doesn't exist
    BEGIN
        CREATE POLICY "Users can update own profile." ON profiles
        FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    EXCEPTION WHEN duplicate_object THEN
        -- Policy already exists, so we don't need to do anything
        RAISE NOTICE 'Policy "Users can update own profile." already exists';
    END;
END $$;

-- Grant permissions on the new column
GRANT SELECT ON profiles TO anon, authenticated;
GRANT UPDATE (avatar_seed) ON profiles TO authenticated;
