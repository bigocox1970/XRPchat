import React, { createContext, useContext, useState } from 'react';

interface EncryptionModeContextType {
  showEncrypted: boolean;
  toggleEncryptionMode: () => void;
}

const EncryptionModeContext = createContext<EncryptionModeContextType | undefined>(undefined);

export const EncryptionModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showEncrypted, setShowEncrypted] = useState(false);

  const toggleEncryptionMode = () => {
    setShowEncrypted(!showEncrypted);
  };

  return (
    <EncryptionModeContext.Provider value={{ showEncrypted, toggleEncryptionMode }}>
      {children}
    </EncryptionModeContext.Provider>
  );
};

export const useEncryptionMode = () => {
  const context = useContext(EncryptionModeContext);
  if (context === undefined) {
    throw new Error('useEncryptionMode must be used within an EncryptionModeProvider');
  }
  return context;
};
