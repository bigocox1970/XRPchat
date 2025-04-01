import { supabase } from './client';

/**
 * Updates the database schema to add auto_delete_settings column to profiles table
 */
export const updateAutoDeleteSchema = async (): Promise<boolean> => {
  try {
    // Check if the column already exists
    const { data: columns, error: checkError } = await supabase
      .from('profiles')
      .select('auto_delete_settings')
      .limit(1);
    
    if (!checkError) {
      console.log('auto_delete_settings column already exists');
      return true;
    }
    
    // Execute raw SQL to add the column
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS auto_delete_settings JSONB;
        
        COMMENT ON COLUMN profiles.auto_delete_settings IS 'JSON object containing user auto-delete message settings';
      `
    });
    
    if (error) {
      console.error('Error updating schema:', error);
      return false;
    }
    
    console.log('Successfully added auto_delete_settings column to profiles table');
    return true;
  } catch (error) {
    console.error('Error in updateAutoDeleteSchema:', error);
    return false;
  }
}; 