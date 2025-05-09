import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserContext';
import { 
  isPrivateKeyAvailable, 
  setPrivateKeyAvailable, 
  isEncryptedViewEnabled, 
  setEncryptedViewEnabled 
} from '../utils/privateKeyHelpers';

interface EncryptionModeContextType {
  isMaxSecurityEnabled: boolean;
  temporaryPrivateKey: string | null;
  setTemporaryPrivateKey: (key: string | null) => void;
  enableMaxSecurity: () => void;
  disableMaxSecurity: () => void;
  showPrivateKey: boolean;
  setShowPrivateKey: (show: boolean) => void;
  showEncrypted: boolean;
  toggleEncryptionMode: () => void;
  lockEncryption: () => void;
  isPrivateKeyDisabled: boolean;
  togglePrivateKeyDisabled: () => void;
}

const EncryptionModeContext = createContext<EncryptionModeContextType | undefined>(undefined);

export const EncryptionModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [isMaxSecurityEnabled, setIsMaxSecurityEnabled] = useState(false);
  const [temporaryPrivateKey, setTemporaryPrivateKey] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isPrivateKeyDisabled, setIsPrivateKeyDisabled] = useState(!isPrivateKeyAvailable());
  
  // Initialize showEncrypted from localStorage if available
  const [showEncrypted, setShowEncrypted] = useState<boolean>(isEncryptedViewEnabled());

  // Sync showEncrypted with localStorage whenever it changes
  useEffect(() => {
    setEncryptedViewEnabled(showEncrypted);
  }, [showEncrypted]);

  // Reset state when user logs out
  useEffect(() => {
    if (!user) {
      setIsMaxSecurityEnabled(false);
      setTemporaryPrivateKey(null);
      setShowPrivateKey(false);
      setIsPrivateKeyDisabled(false);
      // Don't reset showEncrypted as it should persist across sessions
    }
  }, [user]);

  // Update encrypted mode and private key status when localStorage changes
  useEffect(() => {
    // Function to sync state with localStorage
    const syncStateWithStorage = () => {
      // Get key availability
      const keyAvailable = isPrivateKeyAvailable();
      setIsPrivateKeyDisabled(!keyAvailable);
      
      // If key is available, make sure we're not in encrypted view mode
      if (keyAvailable && isEncryptedViewEnabled()) {
        console.log('Private key is available, forcing decrypted view');
        setEncryptedViewEnabled(false);
        setShowEncrypted(false);
      } else {
        // Otherwise respect the saved value
        setShowEncrypted(isEncryptedViewEnabled());
      }
    };
    
    // Listen for storage events (for multi-tab support)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'xrpchat_private_key_available') {
        syncStateWithStorage();
      }
    };
    
    // Also listen for custom privateKeyRestored event
    const handleKeyRestored = () => {
      setIsPrivateKeyDisabled(false);
      setShowEncrypted(false);
    };
    
    // Initial sync
    syncStateWithStorage();
    
    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('privateKeyRestored', handleKeyRestored);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('privateKeyRestored', handleKeyRestored);
    };
  }, []);

  const enableMaxSecurity = () => {
    setIsMaxSecurityEnabled(true);
    setTemporaryPrivateKey(null); // Clear any stored key
  };

  const disableMaxSecurity = () => {
    setIsMaxSecurityEnabled(false);
    setTemporaryPrivateKey(null);
  };

  const toggleEncryptionMode = () => {
    // If we're currently in "showEncrypted=true" mode AND the private key is available, 
    // force to decrypted view. Otherwise just toggle.
    if (showEncrypted && isPrivateKeyAvailable()) {
      setShowEncrypted(false);
    } else {
      setShowEncrypted(prev => !prev);
    }
  };

  const lockEncryption = () => {
    setShowEncrypted(false);
  };

  const togglePrivateKeyDisabled = () => {
    const newState = !isPrivateKeyDisabled;
    setIsPrivateKeyDisabled(newState);
    setPrivateKeyAvailable(!newState);
  };

  const value = {
    isMaxSecurityEnabled,
    temporaryPrivateKey,
    setTemporaryPrivateKey,
    enableMaxSecurity,
    disableMaxSecurity,
    showPrivateKey,
    setShowPrivateKey,
    showEncrypted,
    toggleEncryptionMode,
    lockEncryption,
    isPrivateKeyDisabled,
    togglePrivateKeyDisabled,
  };

  return <EncryptionModeContext.Provider value={value}>{children}</EncryptionModeContext.Provider>;
};

export function useEncryptionMode() {
  const context = useContext(EncryptionModeContext);
  if (context === undefined) {
    throw new Error('useEncryptionMode must be used within an EncryptionModeProvider');
  }
  return context;
}
