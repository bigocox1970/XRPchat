/**
 * Helper functions for managing private key state throughout the app
 */

/**
 * Check if the private key is available
 * @returns {boolean} True if the private key is available on this device
 */
export const isPrivateKeyAvailable = (): boolean => {
  return localStorage.getItem('xrpchat_private_key_available') !== 'false';
};

/**
 * Set the private key's availability state and notify listeners
 * @param {boolean} isAvailable - Whether the private key is available on this device
 */
export const setPrivateKeyAvailable = (isAvailable: boolean): void => {
  localStorage.setItem('xrpchat_private_key_available', isAvailable ? 'true' : 'false');
  
  // If making the key available, also force decrypted view
  if (isAvailable) {
    localStorage.setItem('xrpchat_show_encrypted', 'false');
    
    // Notify the app that the key is now available via custom event
    // This will trigger re-rendering of encrypted messages
    const event = new CustomEvent('privateKeyRestored', { 
      detail: { success: true, timestamp: Date.now() }
    });
    
    console.log('Dispatching privateKeyRestored event');
    window.dispatchEvent(event);
    
    // Also force a refresh for components that depend on localStorage
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'xrpchat_private_key_available',
      newValue: 'true',
      oldValue: 'false',
      storageArea: localStorage
    }));
  }
};

/**
 * Check if encrypted view is enabled
 * @returns {boolean} True if encrypted view is enabled
 */
export const isEncryptedViewEnabled = (): boolean => {
  const saved = localStorage.getItem('xrpchat_show_encrypted');
  try {
    return saved ? JSON.parse(saved) : false;
  } catch (e) {
    return false;
  }
};

/**
 * Set encrypted view mode and notify listeners
 * @param {boolean} isEnabled - Whether encrypted view should be enabled
 */
export const setEncryptedViewEnabled = (isEnabled: boolean): void => {
  localStorage.setItem('xrpchat_show_encrypted', isEnabled ? 'true' : 'false');
}; 