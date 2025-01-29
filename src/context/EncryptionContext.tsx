import React, { createContext, useContext, useCallback } from 'react';
import { useUser } from './UserContext';
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
    if (!user || !wallet) throw new Error('Not authenticated or no wallet available');

    try {
      const recipientPublicKey = await getRecipientPublicKey(recipientId);
      return await encryptMessage(message, recipientPublicKey);
    } catch (error) {
      throw error;
    }
  }, [user, wallet, getRecipientPublicKey]);

  const decryptIncomingMessage = useCallback(async (
    encryptedMessage: string
  ): Promise<string> => {
    if (!wallet) throw new Error('No wallet available');

    try {
      return await decryptMessage(encryptedMessage, wallet.private_key);
    } catch (error) {
      throw error;
    }
  }, [wallet]);

  const value = {
    encryptForRecipient,
    decryptMessage: decryptIncomingMessage,
    getRecipientPublicKey,
    isReady: Boolean(wallet && user)
  };

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
};

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
};
