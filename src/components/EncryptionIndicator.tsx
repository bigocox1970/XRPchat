import React from 'react';
import { IoLockClosed, IoLockOpen } from 'react-icons/io5';
import { useEncryptionMode } from '../context/EncryptionModeContext';

export const EncryptionIndicator: React.FC = () => {
  const { showEncrypted, toggleEncryptionMode } = useEncryptionMode();
  
  return (
    <button
      onClick={toggleEncryptionMode}
      className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        showEncrypted
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 natural-light:bg-[#F5EEE0] natural-dark:bg-[#8B5A2B]/30 natural-light:text-[#8B5A2B] natural-dark:text-[#D2BC9B] natural-light:hover:bg-[#E5DBCC] natural-dark:hover:bg-[#8B5A2B]/50'
      }`}
      title={showEncrypted ? 'Showing encrypted text - Click to show decrypted' : 'Showing decrypted text - Click to see encrypted format'}
    >
      {showEncrypted ? (
        <>
          <IoLockClosed className="w-4 h-4" />
          <span>Encrypted View</span>
        </>
      ) : (
        <>
          <IoLockOpen className="w-4 h-4" />
          <span>Decrypted View</span>
        </>
      )}
    </button>
  );
}; 