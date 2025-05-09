import { supabaseAdmin } from './client';
import { encryptPrivateKeyWithPIN } from '../encryption';

/**
 * Migrates existing wallets to use PIN encryption with a default PIN of "123456"
 * This is a one-time operation that should be run after the PIN feature is deployed
 */
export const migrateExistingWallets = async (): Promise<void> => {
  try {
    console.log('Starting wallet migration to PIN encryption');

    // Get all wallets that don't have PIN enabled
    const { data: wallets, error } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .is('pin_enabled', null);

    if (error) {
      throw error;
    }

    if (!wallets || wallets.length === 0) {
      console.log('No wallets need migration');
      return;
    }

    console.log(`Found ${wallets.length} wallets to migrate`);

    // Default PIN for all existing wallets
    const defaultPin = '123456';
    
    // Process wallets in batches of 10 to avoid overwhelming the database
    const batchSize = 10;
    const batches = Math.ceil(wallets.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min((i + 1) * batchSize, wallets.length);
      const batch = wallets.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${batches} (${batch.length} wallets)`);
      
      // Process each wallet in the batch
      const updates = await Promise.all(
        batch.map(async (wallet) => {
          try {
            // Encrypt the private key with the default PIN
            const encryptedPrivateKey = await encryptPrivateKeyWithPIN(wallet.private_key, defaultPin);
            
            // Return the update object
            return {
              id: wallet.id,
              private_key: encryptedPrivateKey,
              pin_enabled: true,
              pin_last_updated: new Date().toISOString()
            };
          } catch (error) {
            console.error(`Error encrypting wallet ${wallet.id}:`, error);
            // Skip this wallet if encryption fails
            return null;
          }
        })
      );
      
      // Filter out nulls (failed encryptions)
      const validUpdates = updates.filter(Boolean);
      
      if (validUpdates.length > 0) {
        // Update wallets in database
        const { error: updateError } = await supabaseAdmin
          .from('wallets')
          .upsert(validUpdates);
        
        if (updateError) {
          console.error('Error updating wallets:', updateError);
        } else {
          console.log(`Successfully migrated ${validUpdates.length} wallets in batch ${i + 1}`);
        }
      }
      
      // Wait a short time between batches to avoid rate limiting
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('Wallet migration completed');
  } catch (error) {
    console.error('Error in wallet migration:', error);
    throw error;
  }
}; 