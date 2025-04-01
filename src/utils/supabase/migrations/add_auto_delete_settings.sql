-- Add a new column to store auto-delete settings in the profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_delete_settings JSONB;

-- Add a comment to explain what this column is for
COMMENT ON COLUMN profiles.auto_delete_settings IS 'JSON object containing user auto-delete message settings';

-- Add a database trigger to update the updated_at timestamp when auto_delete_settings is updated
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_updated_at();
  END IF;
END
$$; 