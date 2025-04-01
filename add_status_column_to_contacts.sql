-- Add status column to the contacts table if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE contacts ADD COLUMN status TEXT DEFAULT 'active';
    
    -- Comment on the status column
    COMMENT ON COLUMN contacts.status IS 'Status of the contact relationship (active, blocked, etc.)';
    
    -- Create an index on the status column for better query performance
    CREATE INDEX idx_contacts_status ON contacts (status);
    
    -- Update any existing contacts to have 'active' status
    UPDATE contacts SET status = 'active' WHERE status IS NULL;
    
    -- Add a check constraint to ensure status is valid
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_status_check 
      CHECK (status IN ('active', 'blocked', 'pending', 'rejected'));
  END IF;
END $$;

-- Create a function to add the status column if it's missing
CREATE OR REPLACE FUNCTION add_status_column_if_missing()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE contacts ADD COLUMN status TEXT DEFAULT 'active';
    
    -- Comment on the status column
    COMMENT ON COLUMN contacts.status IS 'Status of the contact relationship (active, blocked, etc.)';
    
    -- Create an index on the status column for better query performance
    CREATE INDEX idx_contacts_status ON contacts (status);
    
    -- Update any existing contacts to have 'active' status
    UPDATE contacts SET status = 'active' WHERE status IS NULL;
    
    -- Add a check constraint to ensure status is valid
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_status_check 
      CHECK (status IN ('active', 'blocked', 'pending', 'rejected'));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to force block a contact using direct SQL
CREATE OR REPLACE FUNCTION force_block_contact(p_user_id uuid, p_contact_id uuid)
RETURNS void AS $$
BEGIN
  -- First ensure the status column exists
  PERFORM add_status_column_if_missing();
  
  -- Force the status to blocked with direct SQL
  UPDATE contacts 
  SET status = 'blocked'
  WHERE user_id = p_user_id AND contact_id = p_contact_id;
  
  -- If no rows affected (contact doesn't exist), create it
  IF NOT FOUND THEN
    INSERT INTO contacts (user_id, contact_id, status)
    VALUES (p_user_id, p_contact_id, 'blocked');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 