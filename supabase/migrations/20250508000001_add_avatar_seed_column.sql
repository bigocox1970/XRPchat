-- Add avatar_seed column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- Update RLS policies to allow access to the new column
ALTER POLICY "Public profiles are viewable by everyone." ON profiles
  USING (true) 
  WITH CHECK (false);

ALTER POLICY "Users can update own profile." ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant permissions on the new column
GRANT SELECT ON profiles TO anon, authenticated;
GRANT UPDATE (avatar_seed) ON profiles TO authenticated;
