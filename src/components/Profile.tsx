import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { isValidAddress, generateKeyPair } from '../utils/encryption';
import { HiUser, HiCheck, HiUpload, HiLink, HiKey, HiShieldCheck, HiRefresh, HiBell } from 'react-icons/hi';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { uploadAvatar } from '../utils/supabase/storage';
import { CopyButton } from './CopyButton';
import { QRCodeSVG } from 'qrcode.react';
import { NotificationSettings } from './NotificationSettings';

export const Profile: React.FC = () => {
  const { profile, wallet, updateUserProfile, loading, user, regenerateWallet } = useUser();
  const { isMaxSecurityEnabled, enableMaxSecurity, disableMaxSecurity, showPrivateKey, setShowPrivateKey } = useEncryptionMode();
  
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUrlMode, setIsUrlMode] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newWalletInfo, setNewWalletInfo] = useState<{ privateKey: string; address: string } | null>(null);
  const [hasConfirmedSave, setHasConfirmedSave] = useState(false);

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
      const updates: { username?: string; avatar_url?: string } = {};
      
      if (username !== profile?.username) {
        updates.username = username;
      }
      
      if (avatar && user) {
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
    setShowPrivateKey(false);
    setHasConfirmedSave(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
          <div className="font-semibold">Profile {isMaxSecurityEnabled && <span className="text-xs">(Max Security)</span>}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Profile Information</h3>
            
            {isEditing ? (
              <form onSubmit={handleSubmit} className="mt-5 space-y-6">
                <div>
                  <label className="flex items-center justify-between">
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Security Mode</span>
                    <button
                      type="button"
                      onClick={() => isMaxSecurityEnabled ? disableMaxSecurity() : enableMaxSecurity()}
                      className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${
                        isMaxSecurityEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary`}
                    >
                      <HiShieldCheck className="-ml-0.5 mr-2 h-4 w-4" />
                      {isMaxSecurityEnabled ? 'Max Security On' : 'Max Security Off'}
                    </button>
                  </label>
                  <p className="mt-1 text-sm text-gray-500">Enable for enhanced security features and encryption.</p>
                </div>

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
                      className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Avatar
                  </label>
                  <div className="mt-1 flex items-center space-x-5">
                    <span className="inline-block h-12 w-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-600">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Avatar preview"
                          className="h-full w-full object-cover"
                        />
                      ) : profile.avatar_url ? (
                        <div className="mt-1 h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-600">
                          <img
                            src={`${profile.avatar_url}?t=${new Date().getTime()}`}
                            alt="Profile avatar"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <svg className="h-full w-full text-gray-300 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      )}
                    </span>
                    
                    <div>
                      <input
                        type="file"
                        id="file-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                      >
                        Change
                      </label>
                      
                      {uploadError && (
                        <p className="mt-2 text-sm text-red-600">{uploadError}</p>
                      )}
                      {previewUrl && !uploadError && (
                        <p className="mt-2 text-sm text-green-600">Image ready to upload</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Wallet
                  </label>
                  <div className="mt-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                            {newWalletInfo?.address || wallet.address}
                          </p>
                          <CopyButton text={newWalletInfo?.address || profile.wallet_address} size={5} />
                        </div>
                        {isValidAddress(newWalletInfo?.address || wallet.address) ? (
                          <span className="inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Valid XRP Address
                          </span>
                        ) : (
                          <span className="inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Invalid XRP Address
                          </span>
                        )}
                      </div>
                      
                      {!newWalletInfo && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setRegenerating(true);
                              setUpdateError(null);
                              const keyPair = await generateKeyPair();
                              setNewWalletInfo({
                                privateKey: keyPair.privateKey,
                                address: keyPair.address
                              });
                              setShowPrivateKey(true);
                              setHasConfirmedSave(false);
                            } catch (error) {
                              setUpdateError(error instanceof Error ? error.message : 'Failed to generate new wallet');
                            } finally {
                              setRegenerating(false);
                            }
                          }}
                          disabled={regenerating}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50"
                        >
                          <HiRefresh className={`-ml-0.5 mr-2 h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                          Regenerate Wallet
                        </button>
                      )}
                    </div>

                    {newWalletInfo && showPrivateKey && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
                        <div className="flex items-start">
                          <HiKey className="h-5 w-5 text-red-400 mt-0.5" />
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Important: Save Your Private Key</h3>
                            <div className="mt-2 space-y-4">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-red-700 dark:text-red-300 font-mono break-all">
                                    {newWalletInfo.privateKey}
                                  </p>
                                  <CopyButton text={newWalletInfo.privateKey} size={5} />
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Scan to Import Private Key</h4>
                                <div className="p-4 bg-white dark:bg-gray-700 rounded-lg inline-block">
                                  <QRCodeSVG
                                    value={newWalletInfo.privateKey}
                                    size={200}
                                    level="H"
                                    includeMargin={true}
                                    className="dark:bg-white p-2 rounded"
                                  />
                                </div>
                                <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                                  Use this QR code to import your private key into a hardware wallet
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 space-y-4">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={hasConfirmedSave}
                                  onChange={(e) => setHasConfirmedSave(e.target.checked)}
                                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                                />
                                <span className="text-sm text-red-700 dark:text-red-300">
                                  I confirm that I have saved my private key in a secure location
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setRegenerating(true);
                                    setUpdateError(null);
                                    await regenerateWallet(newWalletInfo.privateKey, newWalletInfo.address);
                                    setNewWalletInfo(null);
                                    setShowPrivateKey(false);
                                    setHasConfirmedSave(false);
                                  } catch (error) {
                                    setUpdateError(error instanceof Error ? error.message : 'Failed to update wallet');
                                  } finally {
                                    setRegenerating(false);
                                  }
                                }}
                                disabled={!hasConfirmedSave}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${!hasConfirmedSave ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                I've Saved My Private Key - Continue
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Share Your Address</h4>
                      <div className="mt-2 p-4 bg-white dark:bg-gray-700 rounded-lg inline-block">
                        <QRCodeSVG
                          value={newWalletInfo?.address || wallet.address}
                          size={200}
                          level="H"
                          includeMargin={true}
                          className="dark:bg-white p-2 rounded"
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Scan this QR code to share your wallet address
                      </p>
                    </div>
                  </div>
                </div>

                {(updateError || uploadError) && (
                  <div className="text-red-600 text-sm">
                    {updateError || uploadError}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateLoading}
                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 ${
                      updateLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {updateLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{profile.username}</p>
                </div>

                {profile.avatar_url && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Avatar</h4>
                    <div className="mt-1 h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-600">
                      <img
                        src={`${profile.avatar_url}?t=${new Date().getTime()}`}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                )}

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
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Share Your Address</h4>
                    <div className="mt-2 p-4 bg-white dark:bg-gray-700 rounded-lg inline-block">
                      <QRCodeSVG
                        value={wallet.address}
                        size={200}
                        level="H"
                        includeMargin={true}
                        className="dark:bg-white p-2 rounded"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Scan this QR code to share your wallet address
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Notification Settings Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <HiBell className="text-gray-900 dark:text-white" size={24} />
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Notification Settings
            </h3>
          </div>
          <NotificationSettings />
        </div>
        
        {/* Encryption Settings Section */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <HiShieldCheck className="text-gray-900 dark:text-white" size={24} />
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Encryption Settings
            </h3>
          </div>
        
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Wallet Information</h3>
              <div className="mt-5 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Wallet Address</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono break-all">
                    {wallet.address}
                  </p>
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

                {wallet.private_key && (
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Private Key</h4>
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                      >
                        {showPrivateKey ? <HiKey size={12} /> : <HiKey size={12} />}
                      </button>
                    </div>
                    {showPrivateKey ? (
                      <div className="mt-1 relative">
                        <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                          {wallet.private_key}
                        </p>
                        <div className="mt-1">
                          <CopyButton text={wallet.private_key} />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        [Hidden for security] Click the key icon to view.
                      </p>
                    )}
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Max Security Mode</h4>
                  <div className="mt-2">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={isMaxSecurityEnabled ? disableMaxSecurity : enableMaxSecurity}
                        className={`${
                          isMaxSecurityEnabled ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'
                        } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary`}
                      >
                        <span
                          className={`${
                            isMaxSecurityEnabled ? 'translate-x-5' : 'translate-x-0'
                          } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                        />
                      </button>
                      <span className="ml-3 text-sm">
                        <span className="text-gray-900 dark:text-white">
                          {isMaxSecurityEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </span>
                    </div>
                    {isMaxSecurityEnabled ? (
                      <p className="text-sm text-green-600 mt-1">
                        <HiShieldCheck className="inline mr-1" />
                        Maximum security mode is ON. You'll need to provide your private key for each decryption.
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Enable maximum security mode to prevent storing your private key in browser storage.
                      </p>
                    )}
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
      </div>
    </div>
  );
};
