import React from 'react';
import { HiUser } from 'react-icons/hi';

interface AvatarProps {
  url?: string | null;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ url, size = 40, className = '' }) => {
  return (
    <div 
      className={`rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img 
          src={url} 
          alt="Avatar" 
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to icon if image fails to load
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('fallback-active');
          }}
        />
      ) : (
        <HiUser 
          size={size * 0.6} 
          className="text-gray-600 dark:text-gray-300" 
        />
      )}
    </div>
  );
};
