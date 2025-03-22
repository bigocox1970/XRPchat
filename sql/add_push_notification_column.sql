-- Add push_subscription column to profiles table
-- Run this in the Supabase SQL Editor if the push_subscription column doesn't exist

-- First check if the column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'push_subscription'
    ) THEN
        -- Add the push_subscription column to the profiles table
        ALTER TABLE profiles
        ADD COLUMN push_subscription JSONB;
        
        RAISE NOTICE 'push_subscription column added to profiles table';
    ELSE
        RAISE NOTICE 'push_subscription column already exists in profiles table';
    END IF;
END $$;

-- Add an index for faster searches (optional)
CREATE INDEX IF NOT EXISTS idx_profiles_push_subscription
ON profiles USING GIN (push_subscription);

-- Make sure RLS policies are updated to allow access to the new column
-- This assumes you already have policies for the profiles table

-- Check if policies exist before trying to alter them
DO $$
DECLARE
    select_policy_exists BOOLEAN;
    update_policy_exists BOOLEAN;
BEGIN
    -- Check if select policy exists
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view their own profile information.'
    ) INTO select_policy_exists;
    
    -- Check if update policy exists
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile information.'
    ) INTO update_policy_exists;
    
    -- If select policy exists, alter it
    IF select_policy_exists THEN
        ALTER POLICY "Users can view their own profile information." 
        ON "public"."profiles" 
        USING ("auth"."uid"() = "id");
        RAISE NOTICE 'Updated select policy for profiles table';
    ELSE
        -- Create a new select policy if it doesn't exist
        CREATE POLICY "profiles_select_policy" 
        ON "public"."profiles" 
        FOR SELECT
        USING ("auth"."uid"() = "id");
        RAISE NOTICE 'Created new select policy for profiles table';
    END IF;
    
    -- If update policy exists, alter it
    IF update_policy_exists THEN
        ALTER POLICY "Users can update their own profile information."
        ON "public"."profiles"
        USING ("auth"."uid"() = "id")
        WITH CHECK ("auth"."uid"() = "id");
        RAISE NOTICE 'Updated update policy for profiles table';
    ELSE
        -- Create a new update policy if it doesn't exist
        CREATE POLICY "profiles_update_policy" 
        ON "public"."profiles" 
        FOR UPDATE
        USING ("auth"."uid"() = "id")
        WITH CHECK ("auth"."uid"() = "id");
        RAISE NOTICE 'Created new update policy for profiles table';
    END IF;
END $$;

-- Make sure RLS is enabled on the profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

COMMIT; 