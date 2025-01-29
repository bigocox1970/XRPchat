import React from 'react';
import { HiClipboard } from 'react-icons/hi';

interface CopyButtonProps {
  text: string;
  size?: number;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 4, className = '' }) => {
  return (
    <div className="relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(text);
          const button = e.currentTarget;
          button.classList.add('text-green-700');
          setTimeout(() => button.classList.remove('text-green-700'), 2000);
        }}
        className={`p-1 text-gray-500 dark:text-white hover:text-green-500 transition-colors ${className}`}
        title="Copy address"
      >
        <HiClipboard className={`h-${size} w-${size}`} />
      </button>
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Copy
      </div>
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-700 text-white text-xs px-2 py-1 rounded opacity-0 group-active:opacity-100 transition-opacity pointer-events-none">
        Copied!
      </div>
    </div>
  );
};
