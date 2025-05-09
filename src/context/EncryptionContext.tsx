import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
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
  needsPIN: boolean;
  enterPIN: (pin: string) => Promise<boolean>;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export const EncryptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { wallet, user, isPINEnabled, decryptWithPIN } = useUser();
  const { isMaxSecurityEnabled, temporaryPrivateKey } = useEncryptionMode();
  
  // Initialize needsPIN based on PIN being enabled, private key availability, and temp key
  const isKeyAvailable = localStorage.getItem('xrpchat_private_key_available') !== 'false';
  const [needsPIN, setNeedsPIN] = useState<boolean>(
    isPINEnabled && !temporaryPrivateKey && !isKeyAvailable
  );
  
  const [privateKeyForSession, setPrivateKeyForSession] = useState<string | null>(null);

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

  const enterPIN = useCallback(async (pin: string): Promise<boolean> => {
    try {
      // Validate PIN (must be 6 digits)
      if (!/^\d{6}$/.test(pin)) {
        throw new Error('PIN must be 6 digits');
      }

      // Try to decrypt the private key with the provided PIN
      const decryptedKey = await decryptWithPIN(pin);
      
      if (decryptedKey) {
        setPrivateKeyForSession(decryptedKey);
        setNeedsPIN(false);
        // Mark private key as locally available
        localStorage.setItem('xrpchat_private_key_available', 'true');
        
        // Dispatch an event to notify components that PIN was entered successfully
        window.dispatchEvent(new CustomEvent('pinEnteredSuccessfully'));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  }, [decryptWithPIN]);

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
      // Check if private key is locally available
      const isKeyLocallyAvailable = localStorage.getItem('xrpchat_private_key_available') !== 'false';
      console.log('Is private key locally available:', isKeyLocallyAvailable);
      
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
      
      // If PIN is enabled AND key is not locally available, we need the PIN
      if (isPINEnabled && !isKeyLocallyAvailable) {
        setNeedsPIN(true);
        throw new Error('PIN required to decrypt messages');
      }
      
      // If PIN is enabled and we have the decrypted key in memory, use it
      if (isPINEnabled && privateKeyForSession) {
        try {
          return await decryptMessage(encryptedMessage, privateKeyForSession);
        } catch (decryptError) {
          console.warn('Decryption failed with session private key');
          
          // Try with wallet.private_key as a fallback
          try {
            return await decryptMessage(encryptedMessage, wallet.private_key);
          } catch (fallbackError) {
            throw new Error('Unable to decrypt message with available keys.');
          }
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
  }, [wallet, isMaxSecurityEnabled, temporaryPrivateKey, isPINEnabled, privateKeyForSession]);

  // Listen for changes in key availability from localStorage
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'xrpchat_private_key_available') {
        const isAvailable = event.newValue !== 'false';
        // Update needsPIN state based on key availability
        setNeedsPIN(isPINEnabled && !temporaryPrivateKey && !isAvailable);
      }
    };
    
    // Also listen for our custom event
    const handlePinEntered = () => {
      setNeedsPIN(false);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pinEnteredSuccessfully', handlePinEntered);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pinEnteredSuccessfully', handlePinEntered);
    };
  }, [isPINEnabled, temporaryPrivateKey]);

  const value = {
    encryptForRecipient,
    decryptMessage: decryptIncomingMessage,
    getRecipientPublicKey,
    isReady: Boolean(wallet && user),
    needsPIN,
    enterPIN
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
