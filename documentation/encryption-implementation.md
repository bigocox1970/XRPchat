# XRPChat Encryption Implementation for Expo

## Overview

The XRPChat application uses end-to-end encryption (E2EE) to secure all messages between users. This document outlines how to implement the encryption system for the Expo version of the app, maintaining the same security principles as the web version.

## Cryptographic Libraries

For the Expo implementation, we recommend using:

- `expo-crypto` - For basic cryptographic operations
- `expo-secure-store` - For securely storing keys
- `tweetnacl` - For the core encryption algorithms (same as web version)

## Key Generation and Management

### Generating Key Pairs

```typescript
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { encode as encodeBase64, decode as decodeBase64 } from 'base64-arraybuffer';
import * as SecureStore from 'expo-secure-store';

export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
  address: string;
}> {
  // Generate the keypair using NaCl
  const keyPair = nacl.box.keyPair();
  
  // Convert keys to storable format
  const publicKeyBase64 = encodeBase64(keyPair.publicKey);
  const privateKeyBase64 = encodeBase64(keyPair.secretKey);
  
  // Generate wallet address from public key
  const publicKeyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    publicKeyBase64
  );
  
  // Use first 20 bytes of hash as wallet address
  const address = publicKeyHash.slice(0, 40);
  
  return {
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
    address: address
  };
}
```

### Secure Key Storage

```typescript
export async function storeKeys(
  userId: string, 
  publicKey: string, 
  privateKey: string
): Promise<void> {
  // Store public key (can be less secure)
  await SecureStore.setItemAsync(`xrpchat_pubkey_${userId}`, publicKey);
  
  // Store private key with maximum security
  await SecureStore.setItemAsync(`xrpchat_privkey_${userId}`, privateKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED
  });
}

export async function getPrivateKey(userId: string): Promise<string | null> {
  return await SecureStore.getItemAsync(`xrpchat_privkey_${userId}`);
}

export async function getPublicKey(userId: string): Promise<string | null> {
  return await SecureStore.getItemAsync(`xrpchat_pubkey_${userId}`);
}
```

## Message Encryption/Decryption

### Encrypting Messages

```typescript
export async function encryptMessage(
  message: string,
  senderPrivateKey: string,
  recipientPublicKey: string
): Promise<string> {
  // Create a one-time nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  
  // Convert keys from Base64 to Uint8Array
  const privateKeyUint8 = new Uint8Array(decodeBase64(senderPrivateKey));
  const publicKeyUint8 = new Uint8Array(decodeBase64(recipientPublicKey));
  
  // Convert message to Uint8Array
  const messageUint8 = new TextEncoder().encode(message);
  
  // Encrypt
  const encryptedMessage = nacl.box(
    messageUint8,
    nonce,
    publicKeyUint8,
    privateKeyUint8
  );
  
  // Combine nonce and encrypted message
  const fullMessage = new Uint8Array(nonce.length + encryptedMessage.length);
  fullMessage.set(nonce);
  fullMessage.set(encryptedMessage, nonce.length);
  
  // Convert to Base64 for storage/transmission
  return encodeBase64(fullMessage);
}
```

### Decrypting Messages

```typescript
export async function decryptMessage(
  encryptedMessage: string,
  recipientPrivateKey: string,
  senderPublicKey: string
): Promise<string | null> {
  try {
    // Convert from Base64 to Uint8Array
    const messageWithNonceUint8 = new Uint8Array(decodeBase64(encryptedMessage));
    
    // Extract nonce
    const nonce = messageWithNonceUint8.slice(0, nacl.box.nonceLength);
    const encryptedMessageOnly = messageWithNonceUint8.slice(nacl.box.nonceLength);
    
    // Convert keys from Base64 to Uint8Array
    const privateKeyUint8 = new Uint8Array(decodeBase64(recipientPrivateKey));
    const publicKeyUint8 = new Uint8Array(decodeBase64(senderPublicKey));
    
    // Decrypt
    const decryptedMessage = nacl.box.open(
      encryptedMessageOnly,
      nonce,
      publicKeyUint8,
      privateKeyUint8
    );
    
    if (!decryptedMessage) return null;
    
    // Convert Uint8Array to string
    return new TextDecoder().decode(decryptedMessage);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}
```

## Group Chat Encryption

For group chats where multiple recipients need to decrypt the message:

```typescript
export async function encryptGroupMessage(
  message: string,
  senderPrivateKey: string,
  recipientPublicKeys: string[]
): Promise<Record<string, string>> {
  // Generate a symmetric key for this message only
  const symmetricKey = nacl.randomBytes(nacl.secretbox.keyLength);
  
  // Encrypt message with the symmetric key
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = new TextEncoder().encode(message);
  const encryptedMessage = nacl.secretbox(messageUint8, nonce, symmetricKey);
  
  // Combine nonce and message for actual content
  const fullMessage = new Uint8Array(nonce.length + encryptedMessage.length);
  fullMessage.set(nonce);
  fullMessage.set(encryptedMessage, nonce.length);
  const encryptedContent = encodeBase64(fullMessage);
  
  // Encrypt symmetric key for each recipient
  const encryptedKeys: Record<string, string> = {};
  
  for (const recipientPublicKey of recipientPublicKeys) {
    const keyNonce = nacl.randomBytes(nacl.box.nonceLength);
    const publicKeyUint8 = new Uint8Array(decodeBase64(recipientPublicKey));
    const privateKeyUint8 = new Uint8Array(decodeBase64(senderPrivateKey));
    
    // Encrypt symmetric key for this recipient
    const encryptedKey = nacl.box(
      symmetricKey,
      keyNonce,
      publicKeyUint8,
      privateKeyUint8
    );
    
    // Combine nonce and encrypted key
    const fullKey = new Uint8Array(keyNonce.length + encryptedKey.length);
    fullKey.set(keyNonce);
    fullKey.set(encryptedKey, keyNonce.length);
    
    // Store by recipient public key
    encryptedKeys[recipientPublicKey] = encodeBase64(fullKey);
  }
  
  return {
    content: encryptedContent,
    keys: encryptedKeys
  };
}
```

## Biometric Protection

Add an extra layer of security with biometric authentication:

```typescript
import * as LocalAuthentication from 'expo-local-authentication';

export async function getPrivateKeyWithBiometrics(userId: string): Promise<string | null> {
  // Check if device supports biometrics
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) {
    console.warn('Biometric authentication not available');
    return getPrivateKey(userId); // Fall back to normal retrieval
  }
  
  // Check if user has enabled biometrics
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    console.warn('No biometrics enrolled on this device');
    return getPrivateKey(userId); // Fall back to normal retrieval
  }
  
  // Authenticate with biometrics
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access your private key',
    fallbackLabel: 'Use passcode',
  });
  
  if (result.success) {
    return getPrivateKey(userId);
  } else {
    console.error('Biometric authentication failed');
    return null;
  }
}
```

## Security Best Practices

1. **Key Isolation**: Private keys should never leave the device.

2. **Transport Security**: Always use HTTPS for API communication.

3. **Key Rotation**: Implement a secure way for users to rotate their keys.

4. **Biometric Protection**: Add biometric verification for sensitive operations.

5. **Secure Wipe**: When messages are deleted, ensure they're securely wiped.

6. **Memory Protection**: Clear sensitive data from memory when no longer needed.

## Mobile-Specific Considerations

1. **App Backgrounding**: Handle encryption state properly when app moves to background.

2. **Device Lock**: Consider re-authenticating when device is unlocked.

3. **Secure Screenshots**: Prevent screenshots of sensitive screens.

```typescript
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

export async function preventScreenCapture() {
  if (Platform.OS === 'ios') {
    await ScreenCapture.preventScreenCaptureAsync();
  }
}

export async function allowScreenCapture() {
  if (Platform.OS === 'ios') {
    await ScreenCapture.allowScreenCaptureAsync();
  }
}
```

4. **Clipboard Protection**: Be cautious with clipboard data.

5. **Storage Encryption**: Use encrypted storage for all sensitive data.

## Key Recovery

Implement a secure key recovery mechanism, such as:

```typescript
export async function backupPrivateKey(
  privateKey: string, 
  recoveryPassword: string
): Promise<string> {
  // Generate a salt
  const salt = nacl.randomBytes(16);
  
  // Derive a key from the recovery password
  const keyUint8 = await pbkdf2(recoveryPassword, salt, 10000, 32);
  
  // Encrypt the private key with the derived key
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const privateKeyUint8 = new Uint8Array(decodeBase64(privateKey));
  
  const encryptedPrivateKey = nacl.secretbox(
    privateKeyUint8,
    nonce,
    keyUint8
  );
  
  // Combine salt, nonce, and encrypted private key
  const backup = new Uint8Array(salt.length + nonce.length + encryptedPrivateKey.length);
  backup.set(salt);
  backup.set(nonce, salt.length);
  backup.set(encryptedPrivateKey, salt.length + nonce.length);
  
  return encodeBase64(backup);
}
```

## Testing Encryption in Expo

Set up proper testing for encryption functionality:

1. Unit tests for encryption/decryption
2. Performance testing on various device types
3. Security audits of implementation
4. Validation of key storage security 