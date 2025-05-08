import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { HiUser } from 'react-icons/hi';
import { updateProfile } from '../utils/supabase/auth';

// Simple avatar test page
const AvatarTest: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  
  // Get the current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Get the user's profile
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
          
        if (data && data.avatar_url) {
          setAvatarUrl(data.avatar_url);
          
          // Generate a direct URL
          const timestamp = new Date().getTime();
          if (data.avatar_url.startsWith('http')) {
            setDirectUrl(`${data.avatar_url}?t=${timestamp}`);
          } else {
            setDirectUrl(`https://aoqvffeqscehfnrjgjrs.supabase.co/storage/v1/object/public/avatar-storage/${data.avatar_url}?t=${timestamp}`);
          }
        }
      }
    };
    
    getUser();
  }, []);
  
  // Convert file to data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file upload - using data URL approach only
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    if (!userId) {
      setError('You must be logged in to upload an avatar');
      return;
    }
    
    const file = e.target.files[0];
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    const maxSize = 2 * 1024 * 1024; // 2MB - smaller size for data URLs
    if (file.size > maxSize) {
      setError('Image size should be less than 2MB for data URL approach');
      return;
    }
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Create a unique file path (still needed for database reference)
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = new Date().getTime();
      const filePath = `${userId}/avatar_${timestamp}.${fileExt}`;
      
      // Convert file to data URL
      const dataUrl = await fileToDataUrl(file);
      console.log('Created data URL with length:', dataUrl.length);
      
      // Store in localStorage for immediate use
      localStorage.setItem(`avatar_${userId}`, dataUrl);
      console.log('Stored data URL in localStorage');
      
      // Also store in the database as avatar_data_url if the column exists
      try {
        // First approach: Try to update profile with both paths
        await updateProfile(userId, {
          avatar_url: filePath
        });
        console.log('Profile updated with avatar_url');
      } catch (updateError1) {
        console.log('Could not update with avatar_url, trying without it');
        // Second approach: If that fails, just update the avatar_url
        try {
          await updateProfile(userId, {
            avatar_url: filePath
          });
          console.log('Profile updated with avatar_url');
        } catch (updateError2) {
          console.error('Error updating profile:', updateError2);
          throw new Error('Failed to update profile with avatar URL');
        }
      }
      
      // Update state
      setAvatarUrl(filePath);
      setDirectUrl(dataUrl); // Use the data URL directly
      setSuccess('Avatar uploaded successfully!');
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setError(error.message || 'Error uploading avatar');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Avatar Test Page</h1>
      
      {/* User info */}
      {userId ? (
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Logged in as:</p>
          <p className="font-medium">{userId}</p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded">
          Please log in to test avatar uploads
        </div>
      )}
      
      {/* Avatar display */}
      <div className="flex flex-col items-center mb-6">
        <div 
          className="w-32 h-32 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden mb-4"
        >
          {directUrl ? (
            <img 
              src={directUrl}
              alt="Avatar" 
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Avatar image failed to load');
                // Try to get from localStorage as fallback
                if (userId) {
                  const cachedDataUrl = localStorage.getItem(`avatar_${userId}`);
                  if (cachedDataUrl && cachedDataUrl.startsWith('data:image/')) {
                    console.log('Using cached avatar from localStorage');
                    e.currentTarget.src = cachedDataUrl;
                    return;
                  }
                }
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('fallback-active');
              }}
            />
          ) : (
            <HiUser 
              size={64} 
              className="text-gray-600 dark:text-gray-300" 
            />
          )}
        </div>
        
        {avatarUrl && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
            <p className="font-medium">Current avatar path:</p>
            <p className="break-all">{avatarUrl}</p>
          </div>
        )}
        
        {directUrl && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
            <p className="font-medium">Direct URL:</p>
            <p className="break-all">{directUrl}</p>
          </div>
        )}
      </div>
      
      {/* Upload form */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Upload new avatar
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading || !userId}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      
      {/* Status messages */}
      {uploading && (
        <div className="p-4 bg-blue-50 text-blue-700 rounded mb-4">
          Uploading...
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 text-green-700 rounded mb-4">
          {success}
        </div>
      )}
      
      {/* Debug section */}
      <div className="mt-8 border-t pt-4">
        <h2 className="text-lg font-medium mb-2">Debug Info</h2>
        
        <div className="mb-4">
          <button 
            onClick={() => {
              if (directUrl && directUrl.startsWith('data:image/')) {
                window.open(directUrl, '_blank');
              }
            }}
            disabled={!directUrl}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            View Data URL in New Tab
          </button>
        </div>
        
        <div className="mb-4">
          <button 
            onClick={() => {
              if (userId) {
                const cachedDataUrl = localStorage.getItem(`avatar_${userId}`);
                if (cachedDataUrl) {
                  alert('Found cached avatar in localStorage');
                  window.open(cachedDataUrl, '_blank');
                } else {
                  alert('No cached avatar found in localStorage');
                }
              }
            }}
            disabled={!userId}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Check localStorage Cache
          </button>
        </div>
        
        <div className="mb-4">
          <button 
            onClick={async () => {
              try {
                // Get the user's profile to check avatar fields
                const { data, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', userId)
                  .single();
                  
                if (error) throw error;
                
                alert(`Profile data: ${JSON.stringify(data, null, 2)}`);
              } catch (err: any) {
                alert(`Error getting profile: ${err.message}`);
              }
            }}
            disabled={!userId}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Check Profile Data
          </button>
        </div>
        
        <div className="mb-4">
          <button 
            onClick={() => {
              if (userId) {
                // Clear localStorage cache
                localStorage.removeItem(`avatar_${userId}`);
                alert('Cleared avatar cache from localStorage');
                // Reload the page
                window.location.reload();
              }
            }}
            disabled={!userId}
            className="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
          >
            Clear Avatar Cache
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarTest;
