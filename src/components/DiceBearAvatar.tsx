import React from 'react';
import { HiUser } from 'react-icons/hi';

interface DiceBearAvatarProps {
  userId?: string;
  url?: string | null;
  size?: number;
  className?: string;
  seed?: string; // Custom seed for avatar generation
}

export const DiceBearAvatar: React.FC<DiceBearAvatarProps> = ({ 
  userId, 
  url, 
  size = 40, 
  className = '',
  seed
}) => {
  // If a URL is provided, use it instead of generating a DiceBear avatar
  if (url) {
    return (
      <div 
        className={`rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <img 
          src={url} 
          alt="Avatar" 
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to DiceBear avatar if image fails to load
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('fallback-active');
          }}
        />
      </div>
    );
  }

  // If userId is provided, generate a DiceBear avatar
  if (userId) {
    // Use DiceBear API to generate an avatar based on userId or custom seed
    // We're using the 'avataaars' collection, but you can change to any supported collection
    const seedValue = seed || userId; // Use custom seed if provided, otherwise use userId
    const diceBearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seedValue)}`;
    
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

  // Fallback to default icon if no URL or userId is provided
  return (
    <div 
      className={`rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <HiUser 
        size={size * 0.6} 
        className="text-gray-600 dark:text-gray-300" 
      />
    </div>
  );
};
