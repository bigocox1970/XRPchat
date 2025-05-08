import React from 'react';
import { HiUser } from 'react-icons/hi';

interface AvatarProps {
  url?: string | null;
  size?: number;
  className?: string;
  userId?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ url, size = 40, className = '', userId }) => {
  // If userId is provided and no URL is provided, generate a DiceBear avatar
  if (userId && !url) {
    // Use DiceBear API to generate an avatar based on userId
    // We're using the 'avataaars' collection, but you can change to any supported collection
    const diceBearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userId)}`;
    
    return (
      <div 
        className={`rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <img 
          src={diceBearUrl} 
          alt="Avatar" 
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to icon if DiceBear fails
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('fallback-active');
          }}
        />
      </div>
    );
  }

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
