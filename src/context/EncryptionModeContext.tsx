import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserContext';

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
}

const EncryptionModeContext = createContext<EncryptionModeContextType | undefined>(undefined);

export const EncryptionModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [isMaxSecurityEnabled, setIsMaxSecurityEnabled] = useState(false);
  const [temporaryPrivateKey, setTemporaryPrivateKey] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showEncrypted, setShowEncrypted] = useState(false);

  // Reset state when user logs out
  useEffect(() => {
    if (!user) {
      setIsMaxSecurityEnabled(false);
      setTemporaryPrivateKey(null);
      setShowPrivateKey(false);
    }
  }, [user]);

  const enableMaxSecurity = () => {
    setIsMaxSecurityEnabled(true);
    setTemporaryPrivateKey(null); // Clear any stored key
  };

  const disableMaxSecurity = () => {
    setIsMaxSecurityEnabled(false);
    setTemporaryPrivateKey(null);
  };

  const toggleEncryptionMode = () => {
    setShowEncrypted(prev => !prev);
  };

  const lockEncryption = () => {
    setShowEncrypted(false);
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
  };

  return <EncryptionModeContext.Provider value={value}>{children}</EncryptionModeContext.Provider>;
};

export const useEncryptionMode = () => {
  const context = useContext(EncryptionModeContext);
  if (context === undefined) {
    throw new Error('useEncryptionMode must be used within an EncryptionModeProvider');
  }
  return context;
};
