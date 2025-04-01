-- Fix Contacts Table Status Column
-- Run this SQL in your Supabase dashboard SQL Editor to fix contact blocking

-- 1. First check if the contacts table exists and create it if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts'
  ) THEN
    CREATE TABLE public.contacts (
      id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      contact_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
      CONSTRAINT contacts_unique_pair UNIQUE (user_id, contact_id)
    );

    -- Add RLS policies
    ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their own contacts"
      ON public.contacts FOR SELECT
      USING (auth.uid() = user_id);
      
    CREATE POLICY "Users can insert their own contacts"
      ON public.contacts FOR INSERT
      WITH CHECK (auth.uid() = user_id);
      
    CREATE POLICY "Users can update their own contacts"
      ON public.contacts FOR UPDATE
      USING (auth.uid() = user_id);
      
    CREATE POLICY "Users can delete their own contacts"
      ON public.contacts FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- 2. Now add the status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN status TEXT DEFAULT 'active';
    
    -- Comment on the status column
    COMMENT ON COLUMN public.contacts.status IS 'Status of the contact relationship (active, blocked, etc.)';
    
    -- Create an index on the status column for better query performance
    CREATE INDEX idx_contacts_status ON public.contacts (status);
    
    -- Add a check constraint to ensure status is valid
    ALTER TABLE public.contacts 
      ADD CONSTRAINT contacts_status_check 
      CHECK (status IN ('active', 'blocked', 'pending', 'rejected'));
  END IF;
END
$$;

-- 3. Update any NULL status values to 'active'
UPDATE public.contacts SET status = 'active' WHERE status IS NULL;

-- 4. Create helper function to add status column if missing
CREATE OR REPLACE FUNCTION public.add_status_column_if_missing()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN status TEXT DEFAULT 'active';
    
    -- Comment on the status column
    COMMENT ON COLUMN public.contacts.status IS 'Status of the contact relationship (active, blocked, etc.)';
    
    -- Create an index on the status column for better query performance
    CREATE INDEX idx_contacts_status ON public.contacts (status);
    
    -- Update any existing contacts to have 'active' status
    UPDATE public.contacts SET status = 'active' WHERE status IS NULL;
    
    -- Add a check constraint to ensure status is valid
    ALTER TABLE public.contacts 
      ADD CONSTRAINT contacts_status_check 
      CHECK (status IN ('active', 'blocked', 'pending', 'rejected'));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to force block a contact
CREATE OR REPLACE FUNCTION public.force_block_contact(p_user_id uuid, p_contact_id uuid)
RETURNS void AS $$
BEGIN
  -- First ensure the status column exists
  PERFORM public.add_status_column_if_missing();
  
  -- Force the status to blocked with direct SQL
  UPDATE public.contacts 
  SET status = 'blocked'
  WHERE user_id = p_user_id AND contact_id = p_contact_id;
  
  -- If no rows affected (contact doesn't exist), create it
  IF NOT FOUND THEN
    INSERT INTO public.contacts (user_id, contact_id, status)
    VALUES (p_user_id, p_contact_id, 'blocked');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to force unblock a contact
CREATE OR REPLACE FUNCTION public.force_unblock_contact(p_user_id uuid, p_contact_id uuid)
RETURNS void AS $$
BEGIN
  -- First ensure the status column exists
  PERFORM public.add_status_column_if_missing();
  
  -- Force the status to active with direct SQL
  UPDATE public.contacts 
  SET status = 'active'
  WHERE user_id = p_user_id AND contact_id = p_contact_id;
  
  -- If no rows affected (contact doesn't exist), do nothing
  IF NOT FOUND THEN
    RAISE NOTICE 'Contact not found, nothing to unblock';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create a helper function to check contact status
CREATE OR REPLACE FUNCTION public.get_contact_status(p_user_id uuid, p_contact_id uuid)
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.contacts
  WHERE user_id = p_user_id AND contact_id = p_contact_id;
  
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create a function to fix all NULL status values
CREATE OR REPLACE FUNCTION public.fix_contact_statuses()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.contacts SET status = 'active' WHERE status IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute a fix for any contacts with NULL status
SELECT public.fix_contact_statuses();

-- Log the result
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.contacts WHERE status = 'blocked';
  RAISE NOTICE 'There are now % blocked contacts in the database', v_count;
END
$$; 