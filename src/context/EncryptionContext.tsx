import React, { createContext, useContext, useCallback } from 'react';
import { useUser } from './UserContext';
import { useEncryptionMode } from './EncryptionModeContext';
import { encryptMessage, decryptMessage } from '../utils/encryption';
import { supabase } from '../utils/supabase';
import type { Database } from '../types/supabase';

interface EncryptionContextType {
  encryptForRecipient: (message: string, recipientId: string) => Promise<string>;
  decryptMessage: (encryptedMessage: string) => Promise<string>;
  getRecipientPublicKey: (recipientId: string) => Promise<string>;
  isReady: boolean;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export const EncryptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { wallet, user } = useUser();
  const { isMaxSecurityEnabled, temporaryPrivateKey } = useEncryptionMode();

  const getRecipientPublicKey = useCallback(async (recipientId: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('wallets')
      .select('public_key')
      .eq('profile_id', recipientId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Recipient wallet not found');

    return data.public_key;
  }, [user]);

  const encryptForRecipient = useCallback(async (
    message: string,
    recipientId: string
  ): Promise<string> => {
    // If no wallet is available, just return the original message
    if (!user || !wallet) {
      console.warn('Not authenticated or no wallet available for encryption, returning original message');
      return message; // Return the message as-is instead of throwing an error
    }

    try {
      const recipientPublicKey = await getRecipientPublicKey(recipientId);
      return await encryptMessage(message, recipientPublicKey);
    } catch (error) {
      console.error('Error encrypting message:', error);
      return message; // In case of failure, return the original message
    }
  }, [user, wallet, getRecipientPublicKey]);

  const decryptIncomingMessage = useCallback(async (
    encryptedMessage: string
  ): Promise<string> => {
    // Check if wallet is available - if not, just return the message as-is
    if (!wallet) {
      console.warn('No wallet available for decryption, returning original message');
      return encryptedMessage;
    }

    // Early validation for non-encrypted messages
    // If it doesn't look like a base64 string, return it unchanged
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptedMessage)) {
      return encryptedMessage;
    }

    try {
      // In max security mode, require temporary private key for decryption
      if (isMaxSecurityEnabled) {
        if (!temporaryPrivateKey) {
          throw new Error('Please enter your private key to decrypt messages');
        }
        try {
          return await decryptMessage(encryptedMessage, temporaryPrivateKey);
        } catch (decryptError) {
          // Don't log the full error stack to prevent console flooding
          console.warn('Decryption failed with temporary private key');
          throw new Error('Decryption failed. Please check your private key.');
        }
      }
      
      // Normal mode uses stored private key
      try {
        return await decryptMessage(encryptedMessage, wallet.private_key);
      } catch (decryptError) {
        // Don't log the full error stack to prevent console flooding
        console.warn('Decryption failed with stored private key');
        // Return a more user-friendly error message but don't expose the actual error
        throw new Error('Unable to decrypt message. The message may be corrupted or encrypted for someone else.');
      }
    } catch (error) {
      // Don't log the full error stack to prevent console flooding
      console.warn('Error in decryptIncomingMessage:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [wallet, isMaxSecurityEnabled, temporaryPrivateKey]);

  const value = {
    encryptForRecipient,
    decryptMessage: decryptIncomingMessage,
    getRecipientPublicKey,
    isReady: Boolean(wallet && user)
  };

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
};

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}
