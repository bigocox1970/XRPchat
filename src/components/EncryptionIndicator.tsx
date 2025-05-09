import React from 'react';
import { IoLockClosed, IoLockOpen } from 'react-icons/io5';
import { useEncryptionMode } from '../context/EncryptionModeContext';

export const EncryptionIndicator: React.FC = () => {
  const { showEncrypted, toggleEncryptionMode } = useEncryptionMode();
  
  return (
    <button
      onClick={toggleEncryptionMode}
      className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        showEncrypted
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 natural-light:!bg-[#8B5A2B]/20 natural-dark:!bg-[#8B5A2B]/80 natural-light:!text-[#8B5A2B] natural-dark:!text-[#F5EEE0] natural-light:hover:!bg-[#8B5A2B]/30 natural-dark:hover:!bg-[#8B5A2B]'
          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 natural-light:!bg-[#A67C52]/30 natural-dark:!bg-[#A67C52]/40 natural-light:!text-[#4A3C31] natural-dark:!text-[#F5EEE0] natural-light:hover:!bg-[#A67C52]/50 natural-dark:hover:!bg-[#A67C52]/60'
      }`}
      style={{ 
        '--override-bg': 'var(--natural-bg, #A67C52)'
      } as React.CSSProperties}
      title={showEncrypted ? 'Showing encrypted text - Click to show decrypted' : 'Showing decrypted text - Click to see encrypted format'}
    >
      {showEncrypted ? (
        <IoLockClosed className="w-4 h-4" />
      ) : (
        <IoLockOpen className="w-4 h-4" />
      )}
    </button>
  );
}; 