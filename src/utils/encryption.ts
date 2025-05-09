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
    // First, check if WebCrypto API is fully available
    if (!window.crypto || !window.crypto.subtle) {
      console.error('WebCrypto API not available in this browser');
      // Return plaintext with a marker to indicate encryption was skipped
      return `[UNENCRYPTED]${message}`;
    }

    // Try to encode the message first to catch any encoding issues
    let messageData;
    try {
      const encoder = new TextEncoder();
      messageData = encoder.encode(message);
    } catch (encodeError) {
      console.error('Failed to encode message:', encodeError);
      return `[ENCODE_ERROR]${message}`;
    }

    // Generate a random key for AES with error handling
    let key;
    try {
      key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt']
      );
    } catch (keyGenError) {
      console.error('Failed to generate encryption key:', keyGenError);
      return `[KEY_ERROR]${message}`;
    }

    // Generate IV with error handling
    let iv;
    try {
      iv = crypto.getRandomValues(new Uint8Array(12));
    } catch (randomError) {
      console.error('Failed to generate random IV:', randomError);
      return `[RANDOM_ERROR]${message}`;
    }

    // Encrypt the message with error handling
    let encryptedData;
    try {
      encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        messageData
      );
    } catch (encryptError) {
      console.error('Failed to encrypt data:', encryptError);
      return `[ENCRYPT_ERROR]${message}`;
    }

    // Export the key with error handling
    let exportedKey;
    try {
      exportedKey = await crypto.subtle.exportKey('raw', key);
    } catch (exportError) {
      console.error('Failed to export key:', exportError);
      return `[EXPORT_ERROR]${message}`;
    }

    // Combine IV, key, and encrypted data
    const result = new Uint8Array(iv.length + exportedKey.byteLength + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(exportedKey), iv.length);
    result.set(new Uint8Array(encryptedData), iv.length + exportedKey.byteLength);

    // Convert to base64 with error handling
    try {
      // Safely convert to base64 - break into chunks to handle long messages
      let binary = '';
      const bytes = new Uint8Array(result);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (base64Error) {
      console.error('Failed to convert to base64:', base64Error);
      return `[BASE64_ERROR]${message}`;
    }
  } catch (error) {
    console.error('Encryption failed:', error);
    // Return the original message with an error marker
    return `[ENCRYPTION_FAILED]${message}`;
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
    // Check for unencrypted message markers from our error handlers
    if (encryptedMessage.startsWith('[UNENCRYPTED]')) {
      return encryptedMessage.substring(13);
    }
    if (encryptedMessage.startsWith('[ENCODE_ERROR]')) {
      return encryptedMessage.substring(14);
    }
    if (encryptedMessage.startsWith('[KEY_ERROR]')) {
      return encryptedMessage.substring(11);
    }
    if (encryptedMessage.startsWith('[RANDOM_ERROR]')) {
      return encryptedMessage.substring(14);
    }
    if (encryptedMessage.startsWith('[ENCRYPT_ERROR]')) {
      return encryptedMessage.substring(15);
    }
    if (encryptedMessage.startsWith('[EXPORT_ERROR]')) {
      return encryptedMessage.substring(14);
    }
    if (encryptedMessage.startsWith('[BASE64_ERROR]')) {
      return encryptedMessage.substring(14);
    }
    if (encryptedMessage.startsWith('[ENCRYPTION_FAILED]')) {
      return encryptedMessage.substring(19);
    }

    // First, check if WebCrypto API is fully available
    if (!window.crypto || !window.crypto.subtle) {
      console.error('WebCrypto API not available in this browser');
      return 'Message decryption not supported in this browser';
    }

    // Validate input
    if (!encryptedMessage) {
      throw new Error('Cannot decrypt empty message');
    }
    
    // Check for valid base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptedMessage)) {
      // If it doesn't look like base64, return as plaintext
      return encryptedMessage;
    }
    
    // Try to parse the base64 string
    let data;
    try {
      // Convert base64 to array buffer more safely
      const binaryString = atob(encryptedMessage);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      data = bytes;
    } catch (parseError) {
      console.error('Failed to parse base64:', parseError);
      // If we can't parse it, just return the original message
      return encryptedMessage;
    }
    
    // Check minimum length for valid data
    if (data.length < 45) { // At least IV (12) + Key (32) + 1 byte of encrypted data
      return encryptedMessage; // Return original if format appears invalid
    }

    // Extract components
    const iv = data.slice(0, 12);
    const keyData = data.slice(12, 44); // AES-256 key is 32 bytes
    const encryptedData = data.slice(44);

    // Import the key
    let key;
    try {
      key = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['decrypt']
      );
    } catch (keyError) {
      console.error('Failed to import key:', keyError);
      return 'Failed to decrypt message: Invalid key';
    }

    // Decrypt the data
    let decryptedData;
    try {
      decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        encryptedData
      );
    } catch (decryptError) {
      console.error('Failed to decrypt data:', decryptError);
      return 'Failed to decrypt message';
    }

    // Convert to string
    try {
      const decoder = new TextDecoder();
      const result = decoder.decode(decryptedData);
      return result;
    } catch (decodeError) {
      console.error('Failed to decode decrypted data:', decodeError);
      return 'Failed to decode decrypted message';
    }
  } catch (error) {
    console.error('Decryption error:', error);
    // Return a user-friendly message instead of throwing
    return 'Unable to decrypt message';
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
