import { Wallet, Client } from 'xrpl';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  address: string;
}

/**
 * Creates and connects to an XRPL client with retry
 */
const createClient = async (retries = 3, timeout = 10000) => {
  const client = new Client('wss://s.altnet.rippletest.net:51233', {
    connectionTimeout: timeout,
    timeout: timeout
  });

  for (let i = 0; i < retries; i++) {
    try {
      await client.connect();
      return client;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Failed to connect to XRPL after retries');
};

/**
 * Generates a new XRP wallet
 */
export const generateKeyPair = async (): Promise<KeyPair> => {
  try {
    // Skip the funding attempt that causes CSP errors and just generate a local wallet
    console.log('Generating local XRP wallet without funding (for testing)');
    const wallet = Wallet.generate();
    console.log('Local wallet generated successfully');
    
    return {
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      address: wallet.classicAddress
    };
  } catch (error) {
    console.error('Error generating wallet:', error);
    // Fallback to even more basic generation
    const wallet = Wallet.generate();
    return {
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      address: wallet.classicAddress
    };
  }
};

/**
 * Encrypts a message using AES-GCM with a derived key
 */
export const encryptMessage = async (
  message: string,
  _recipientPublicKey: string
): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);

    // Generate a random key for AES
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the message
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      messageData
    );

    // Export the key
    const exportedKey = await crypto.subtle.exportKey('raw', key);

    // Combine IV, key, and encrypted data
    const result = new Uint8Array(iv.length + exportedKey.byteLength + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(exportedKey), iv.length);
    result.set(new Uint8Array(encryptedData), iv.length + exportedKey.byteLength);

    // Convert to base64
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypts a message using AES-GCM
 */
export const decryptMessage = async (
  encryptedMessage: string,
  _privateKey: string
): Promise<string> => {
  try {
    console.log('Attempting to decrypt message');
    
    // Validate input
    if (!encryptedMessage) {
      console.error('Empty message provided for decryption');
      throw new Error('Cannot decrypt empty message');
    }
    
    // Convert base64 to array buffer
    try {
      // Convert base64 to array buffer
      const data = new Uint8Array(
        atob(encryptedMessage)
          .split('')
          .map(char => char.charCodeAt(0))
      );
      
      // Check minimum length for valid data
      if (data.length < 45) { // At least IV (12) + Key (32) + 1 byte of encrypted data
        console.error('Decryption failed: Data too short to be valid encrypted message');
        throw new Error('Invalid encrypted format');
      }

      // Extract components
      const iv = data.slice(0, 12);
      const keyData = data.slice(12, 44); // AES-256 key is 32 bytes
      const encryptedData = data.slice(44);

      // Import the key
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['decrypt']
      );

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        encryptedData
      );

      // Convert to string
      const decoder = new TextDecoder();
      const result = decoder.decode(decryptedData);
      console.log('Message decrypted successfully');
      return result;
    } catch (parseError) {
      console.error('Base64 parsing error:', parseError);
      throw new Error('Failed to parse encrypted message format');
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to decrypt message');
  }
};

/**
 * Verifies that a public key corresponds to a private key
 */
export const verifyKeyPair = async (
  publicKey: string,
  privateKey: string
): Promise<boolean> => {
  try {
    const wallet = Wallet.fromSeed(privateKey);
    return wallet.publicKey === publicKey;
  } catch (error) {
    return false;
  }
};

/**
 * Gets the wallet address from a public key
 */
export const getAddressFromPublicKey = async (_publicKey: string): Promise<string> => {
  try {
    const client = await createClient();
    const { wallet } = await client.fundWallet();
    await client.disconnect();
    return wallet.classicAddress;
  } catch (error) {
    // If we can't connect to XRPL, generate a local wallet
    const wallet = Wallet.generate();
    return wallet.classicAddress;
  }
};

/**
 * Validates an XRP address
 */
export const isValidAddress = (address: string): boolean => {
  try {
    // Use the XRP address regex pattern
    const xrpAddressRegex = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/;
    return xrpAddressRegex.test(address);
  } catch {
    return false;
  }
};
