import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { isValidAddress, generateKeyPair } from '../utils/encryption';
import { HiUser, HiCheck, HiUpload, HiLink, HiKey, HiShieldCheck, HiRefresh, HiChevronDown } from 'react-icons/hi';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { uploadAvatar } from '../utils/supabase/storage';
import { CopyButton } from './CopyButton';
import { DiceBearAvatar } from './DiceBearAvatar';
import { QRCodeSVG } from 'qrcode.react';
import { PINManagement } from './PINManagement';

export const Profile: React.FC = () => {
  const { profile, wallet, updateUserProfile, loading, user, regenerateWallet, changePassword, deleteAccount, refreshProfile } = useUser();
  const { 
    isMaxSecurityEnabled, 
    enableMaxSecurity, 
    disableMaxSecurity 
  } = useEncryptionMode();
  
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newWalletInfo, setNewWalletInfo] = useState<{ privateKey: string; address: string } | null>(null);
  const [hasConfirmedSave, setHasConfirmedSave] = useState(false);
  // Add state for avatar seed
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  
  // Initialize avatar seed from profile
  useEffect(() => {
    if (profile && profile.avatar_seed) {
      setAvatarSeed(profile.avatar_seed);
    }
  }, [profile]);
  
  // For change password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // For delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Listen for app-refresh events
  useEffect(() => {
    const handleAppRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      const path = customEvent.detail?.path;
      
      // Only refresh if we're on the profile page
      if (path && path === '/app/profile') {
        console.log('Refreshing profile data due to refresh event');
        
        if (refreshProfile) {
          refreshProfile();
        }
      }
    };
    
    // Add event listener
    window.addEventListener('app-refresh', handleAppRefresh);
    
    // Cleanup
    return () => {
      window.removeEventListener('app-refresh', handleAppRefresh);
    };
  }, [refreshProfile]);

  if (loading || !profile || !wallet) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadError(null);
    setAvatar(file);
    
    // Create local preview URL
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateLoading(true);

    try {
      const updates: { username?: string; avatar_url?: string | null } = {};
      
      if (username !== profile?.username) {
        updates.username = username;
      }
      
      // If avatar is null and previewUrl is null, but we're in edit mode,
      // it means the user wants to use the generated avatar
      if (avatar === null && previewUrl === null && profile.avatar_url) {
        // Set avatar_url to null to use the generated avatar
        updates.avatar_url = null;
      } else if (avatar && user) {
        console.log('Uploading new avatar...');
        try {
          // Upload avatar and get URL
          const uploadedAvatarUrl = await uploadAvatar(avatar, user.id);
          console.log('Avatar uploaded successfully:', uploadedAvatarUrl);
          if (uploadedAvatarUrl) {
            updates.avatar_url = uploadedAvatarUrl;
          }
        } catch (error) {
          console.error('Error uploading avatar:', error);
          setUploadError(error instanceof Error ? error.message : 'Failed to upload avatar');
          setUpdateLoading(false);
          return;
        }
      }

      if (Object.keys(updates).length > 0) {
        console.log('Updating profile with:', updates);
        await updateUserProfile(updates);
        console.log('Profile updated successfully');
      }

      // Reset form state
      setAvatar(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setUpdateError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCancel = () => {
    setUsername(profile.username);
    setAvatar(null);
    setPreviewUrl(null);
    setIsEditing(false);
    setUpdateError(null);
    setNewWalletInfo(null);
    setHasConfirmedSave(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordLoading(true);

    // Validate passwords
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      setPasswordLoading(false);
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      
      // Auto-close form after success
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteLoading(true);

    // Validate confirmation
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      setDeleteLoading(false);
      return;
    }

    try {
      await deleteAccount(deletePassword);
      // No need to do anything here - user will be signed out and redirected
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete account');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 natural-light:bg-natural-background natural-dark:bg-natural-dark-background">
      {/* Header */}
      <div className="bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="font-semibold">Profile</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* User Profile Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Profile Information</h3>
            
            {isEditing ? (
              <form onSubmit={handleSubmit} className="mt-5 space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Username
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="username"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Avatar
                  </label>
                  <div className="mt-1 flex flex-wrap items-start">
                    {/* Avatar and regenerate button */}
                    <div className="relative mr-4">
                      <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-600">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Avatar preview"
                            className="h-full w-full object-cover"
                          />
                        ) : profile.avatar_url ? (
                          <img
                            src={`${profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://aoqvffeqscehfnrjgjrs.supabase.co/storage/v1/object/public/avatar-storage/${profile.avatar_url}`}?t=${new Date().getTime()}`}
                            alt="Profile avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <DiceBearAvatar 
                            userId={user?.id || ''} 
                            size={80} 
                            seed={avatarSeed || undefined}
                            key={avatarSeed || user?.id} // Add key to force re-render when seed changes
                          />
                        )}
                      </div>
                      {/* Regenerate button positioned at the bottom right of the avatar */}
                      <button
                        type="button"
                        onClick={() => {
                          console.log("Regenerating avatar with new seed");
                          // Generate a random seed
                          const newSeed = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                          console.log("New seed generated:", newSeed);
                          
                          // Update local state immediately for visual feedback
                          setAvatarSeed(newSeed);
                          
                          // Update profile with the new seed
                          updateUserProfile({ 
                            avatar_url: null,
                            avatar_seed: newSeed // Store the seed in the profile
                          })
                            .then(() => {
                              console.log('Avatar regenerated with new seed:', newSeed);
                            })
                            .catch(error => {
                              console.error('Error updating profile with new avatar seed:', error);
                              setUpdateError(error instanceof Error ? error.message : 'Failed to regenerate avatar');
                            });
                        }}
                        className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 rounded-full p-1 shadow-sm text-gray-700 dark:text-gray-300 hover:text-brand-primary dark:hover:text-brand-primary focus:outline-none"
                        aria-label="Regenerate Avatar"
                      >
                        <HiRefresh size={16} />
                      </button>
                    </div>
                    
                    {/* Avatar source controls and action buttons */}
                    <div className="flex-1 flex flex-col space-y-2">
                      <input
                        type="file"
                        id="file-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      
                      <div className="flex flex-col space-y-2">
                        {/* Avatar Source Row */}
                        <div className="flex justify-between items-center gap-2">
                          {/* Avatar Type Dropdown */}
                          <div className="relative inline-block">
                            <select
                              className="inline-flex items-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 pl-3 pr-8 text-sm leading-4 font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary appearance-none w-auto"
                              value={isUrlMode ? 'url' : avatar ? 'upload' : 'generated'}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === 'generated') {
                                  // Use generated avatar
                                  setIsUrlMode(false);
                                  setAvatar(null);
                                  if (previewUrl) {
                                    URL.revokeObjectURL(previewUrl);
                                    setPreviewUrl(null);
                                  }
                                  
                                  // Update profile to use generated avatar
                                  updateUserProfile({ avatar_url: null })
                                    .then(() => {
                                      console.log('Profile updated to use generated avatar');
                                    })
                                    .catch(error => {
                                      console.error('Error updating profile to use generated avatar:', error);
                                      setUpdateError(error instanceof Error ? error.message : 'Failed to update avatar');
                                    });
                                } else if (value === 'upload') {
                                  // Trigger file upload dialog
                                  setIsUrlMode(false);
                                  document.getElementById('file-upload')?.click();
                                } else if (value === 'url') {
                                  // Show URL input field
                                  setIsUrlMode(true);
                                }
                              }}
                            >
                              <option value="generated">Generated Avatar</option>
                              <option value="upload">Upload Image</option>
                              <option value="url">Image URL</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                              <HiChevronDown className="h-5 w-5" aria-hidden="true" />
                            </div>
                          </div>
                          
                          {/* Action buttons side by side */}
                          <div className="col-span-4 flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={handleCancel}
                              className="bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={updateLoading}
                              className={`inline-flex justify-center py-2 px-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 ${
                                updateLoading ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {updateLoading ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                        
                        {/* URL input field (shown only when URL option is selected) */}
                        {isUrlMode && (
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-8">
                              <input
                                type="text"
                                placeholder="Enter image URL"
                                className="block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                onChange={(e) => {
                                  const url = e.target.value;
                                  if (url) {
                                    setAvatar(null);
                                    if (previewUrl) {
                                      URL.revokeObjectURL(previewUrl);
                                    }
                                    setPreviewUrl(url);
                                    
                                    // Update profile with URL
                                    updateUserProfile({ avatar_url: url })
                                      .then(() => {
                                        console.log('Profile updated with avatar URL');
                                      })
                                      .catch(error => {
                                        console.error('Error updating profile with avatar URL:', error);
                                        setUpdateError(error instanceof Error ? error.message : 'Failed to update avatar');
                                      });
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {uploadError && (
                        <p className="text-sm text-red-600">{uploadError}</p>
                      )}
                      {previewUrl && !uploadError && (
                        <p className="text-sm text-green-600">Image ready to upload</p>
                      )}
                    </div>
                  </div>
                </div>

                {(updateError || uploadError) && (
                  <div className="text-red-600 text-sm mt-2">
                    {updateError || uploadError}
                  </div>
                )}
              </form>
            ) : (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-14 w-14">
                      <DiceBearAvatar userId={user?.id || ''} size={56} seed={avatarSeed || undefined} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</h4>
                      <p className="text-sm text-gray-900 dark:text-white">{profile.username}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Security Section */}
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-4">
            <HiKey className="text-gray-900 dark:text-white" size={24} />
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Wallet & Encryption Settings
            </h3>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-4">
                {/* Change Password */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Password</h4>
                  {!showChangePassword ? (
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                    >
                      Change Password
                    </button>
                  ) : (
                    <form onSubmit={handleChangePassword} className="mt-3 space-y-4">
                      <div>
                        <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Current Password
                        </label>
                        <div className="mt-1">
                          <input
                            id="current-password"
                            name="current-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          New Password
                        </label>
                        <div className="mt-1">
                          <input
                            id="new-password"
                            name="new-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Confirm New Password
                        </label>
                        <div className="mt-1">
                          <input
                            id="confirm-new-password"
                            name="confirm-new-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          />
                        </div>
                      </div>
                      
                      {passwordError && (
                        <div className="text-red-600 text-sm">
                          {passwordError}
                        </div>
                      )}
                      
                      {passwordSuccess && (
                        <div className="text-green-600 text-sm">
                          Password changed successfully!
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowChangePassword(false);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                            setPasswordError(null);
                            setPasswordSuccess(false);
                          }}
                          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={passwordLoading}
                          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 ${
                            passwordLoading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {passwordLoading ? 'Changing...' : 'Change Password'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
                
                {/* Delete Account */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-red-500">Danger Zone</h4>
                  {!showDeleteAccount ? (
                    <button
                      onClick={() => setShowDeleteAccount(true)}
                      className="mt-2 inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-700 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <form onSubmit={handleDeleteAccount} className="mt-3 space-y-4">
                      <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                              Warning: This action cannot be undone
                            </h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                              <p>
                                Deleting your account will permanently remove all your data, including:
                                <ul className="list-disc pl-5 mt-1">
                                  <li>Your profile information</li>
                                  <li>Your wallet data and encryption keys</li>
                                  <li>Your chat history and contacts</li>
                                </ul>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    
                      <div>
                        <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Enter your password to confirm
                        </label>
                        <div className="mt-1">
                          <input
                            id="delete-password"
                            name="delete-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="delete-confirmation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Type DELETE to confirm
                        </label>
                        <div className="mt-1">
                          <input
                            id="delete-confirmation"
                            name="delete-confirmation"
                            type="text"
                            required
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                          />
                        </div>
                      </div>
                      
                      {deleteError && (
                        <div className="text-red-600 text-sm">
                          {deleteError}
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteAccount(false);
                            setDeletePassword('');
                            setDeleteConfirmation('');
                            setDeleteError(null);
                          }}
                          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={deleteLoading || deleteConfirmation !== 'DELETE'}
                          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                            deleteLoading || deleteConfirmation !== 'DELETE' ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Encryption Settings Section */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <HiShieldCheck className="text-gray-900 dark:text-white" size={24} />
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Wallet & Encryption Settings
            </h3>
          </div>
        
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="mt-5 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Wallet Address</h4>
                  <div className="mt-1 flex items-center space-x-2">
                    <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                      {wallet.address}
                    </p>
                    <CopyButton text={profile.wallet_address} size={5} />
                  </div>
                  {isValidAddress(wallet.address) ? (
                    <span className="inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Valid XRP Address
                    </span>
                  ) : (
                    <span className="inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Invalid XRP Address
                    </span>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">QR Code</h4>
                  <div className="mt-2 bg-white p-2 rounded-lg inline-block">
                    <QRCodeSVG value={wallet.address} size={150} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Regenerate Wallet Keys</h4>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Warning: Regenerating your wallet will create new encryption keys. You will no longer be able to decrypt previous messages.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setRegenerating(true);
                      try {
                        // Generate new keypair locally first
                        const keyPair = await generateKeyPair();
                        setNewWalletInfo({ privateKey: keyPair.privateKey, address: keyPair.address });
                      } catch (error) {
                        console.error('Error generating new wallet:', error);
                        setUpdateError('Failed to generate new wallet keys');
                      } finally {
                        setRegenerating(false);
                      }
                    }}
                    disabled={regenerating || !!newWalletInfo}
                    className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerating ? 'Generating...' : <><HiRefresh className="mr-1" /> Regenerate Wallet</>}
                  </button>
                </div>

                {newWalletInfo && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-md">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">New Wallet Information</h4>
                    <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                      Please save this information in a safe place. It will not be shown again.
                    </p>
                    
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-yellow-800 dark:text-yellow-200">New Address:</h5>
                      <p className="text-sm font-mono text-yellow-700 dark:text-yellow-300 break-all">{newWalletInfo.address}</p>
                      <div className="mt-1">
                        <CopyButton text={newWalletInfo.address} />
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-yellow-800 dark:text-yellow-200">New Private Key:</h5>
                      <p className="text-sm font-mono text-yellow-700 dark:text-yellow-300 break-all">{newWalletInfo.privateKey}</p>
                      <div className="mt-1">
                        <CopyButton text={newWalletInfo.privateKey} />
                      </div>
                    </div>
                    
                    <div className="mt-4 flex space-x-3">
                      <button
                        type="button"
                        onClick={async () => {
                          setRegenerating(true);
                          try {
                            await regenerateWallet(newWalletInfo.privateKey, newWalletInfo.address);
                            setNewWalletInfo(null);
                            setHasConfirmedSave(false);
                          } catch (error) {
                            console.error('Error saving new wallet:', error);
                            setUpdateError('Failed to save new wallet keys');
                          } finally {
                            setRegenerating(false);
                          }
                        }}
                        disabled={regenerating || !hasConfirmedSave}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {regenerating ? 'Saving...' : 'Save New Wallet'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setNewWalletInfo(null);
                          setHasConfirmedSave(false);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    <div className="mt-3 flex items-center">
                      <input
                        id="confirm-save"
                        name="confirm-save"
                        type="checkbox"
                        checked={hasConfirmedSave}
                        onChange={(e) => setHasConfirmedSave(e.target.checked)}
                        className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                      />
                      <label htmlFor="confirm-save" className="ml-2 block text-sm text-yellow-700 dark:text-yellow-300">
                        I confirm that I have saved the new wallet information and understand that I will lose access to previously encrypted messages.
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Max Security Mode */}
        <div className="mt-8 space-y-2">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">PIN Security Settings</h3>
          
          {/* PIN Management Section */}
          <div className="mt-6">
            <PINManagement />
          </div>
          
          {/* Max Security Mode Switch */}
          <div className="mt-6 flex items-center">
            {/* ... existing max security mode code ... */}
          </div>
        </div>
      </div>
    </div>
  );
};
