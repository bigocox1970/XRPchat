import { supabase, supabaseAdmin } from './client';

/**
 * Force unblocks a contact using multiple approaches
 * This is a special function to handle persistent blocking issues
 */
export const forceUnblockContact = async (contactId: string): Promise<boolean> => {
  if (!contactId) {
    console.error('Invalid contact ID for force unblock');
    return false;
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.id) {
      console.error('No authenticated user for force unblock');
      return false;
    }

    console.log(`NUCLEAR UNBLOCK: Starting force unblock for ${contactId}`);
    
    // Track success of each approach
    const results = {
      standardUpdate: false,
      delete: false,
      recreate: false
    };
    
    // Approach 1: Standard update (least invasive)
    try {
      console.log(`Approach 1: Standard update for contact ${contactId}`);
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'active' })
        .eq('user_id', user.id)
        .eq('contact_id', contactId);
      
      if (error) {
        console.error('Standard update failed:', error);
      } else {
        results.standardUpdate = true;
        console.log('Standard update successful');
      }
    } catch (err) {
      console.error('Error in standard update:', err);
    }
    
    // Approach 2: Delete and recreate (more aggressive)
    try {
      // First get any existing contact data for reference
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('contact_id', contactId)
        .single();
      
      console.log(`Approach 2: Delete and recreate for contact ${contactId}`);
      console.log('Existing contact data:', existingContact);
      
      // Delete the contact
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_id', contactId);
      
      if (deleteError) {
        console.error('Delete failed:', deleteError);
      } else {
        results.delete = true;
        console.log('Delete successful');
        
        // Short delay to ensure delete is processed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Recreate the contact with active status
        const { error: createError } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            contact_id: contactId,
            status: 'active'
          });
        
        if (createError) {
          console.error('Recreate failed:', createError);
        } else {
          results.recreate = true;
          console.log('Recreate successful');
        }
      }
    } catch (err) {
      console.error('Error in delete/recreate approach:', err);
    }
    
    // Check if contact is truly unblocked
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('status')
        .eq('user_id', user.id)
        .eq('contact_id', contactId)
        .single();
      
      console.log('Final status check:', { data, error });
      
      if (error) {
        console.error('Final status check failed:', error);
      } else if (data.status === 'blocked') {
        console.error('CRITICAL: Contact still blocked after all approaches!');
        return false;
      } else if (data.status === 'active') {
        console.log('SUCCESS: Contact successfully unblocked!');
        return true;
      } else {
        console.log(`WEIRD: Contact has strange status: ${data.status}`);
      }
    } catch (finalErr) {
      console.error('Error checking final status:', finalErr);
    }
    
    // If we get here, consider it a success if any approach worked
    const finalResult = results.standardUpdate || results.recreate;
    console.log(`Force unblock final result: ${finalResult ? 'SUCCESS' : 'FAILURE'}`);
    return finalResult;
  } catch (error) {
    console.error('Unexpected error in force unblock:', error);
    return false;
  }
};

/**
 * Utility to verify if a contact is blocked
 */
export const checkIfContactBlocked = async (contactId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.id) return false;
    
    const { data, error } = await supabase
      .from('contacts')
      .select('status')
      .eq('user_id', user.id)
      .eq('contact_id', contactId)
      .single();
    
    if (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
    
    return data?.status === 'blocked';
  } catch (error) {
    console.error('Error in checkIfContactBlocked:', error);
    return false;
  }
}; 