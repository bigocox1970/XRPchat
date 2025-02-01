import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { isValidAddress, generateKeyPair } from '../utils/encryption';
import { HiUser, HiCheck, HiUpload, HiLink, HiKey, HiShieldCheck, HiRefresh } from 'react-icons/hi';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { uploadAvatar } from '../utils/supabase/storage';
import { CopyButton } from './CopyButton';
import { QRCodeSVG } from 'qrcode.react';

export const Profile: React.FC = () => {
  const { profile, wallet, updateUserProfile, loading, user, regenerateWallet } = useUser();
  const { isMaxSecurityEnabled, enableMaxSecurity, disableMaxSecurity, showPrivateKey, setShowPrivateKey } = useEncryptionMode();
  
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
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
    if (!file || !user?.id) return;

    setUploadError(null);
    setUpdateLoading(true);

    try {
      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }

      const publicUrl = await uploadAvatar(file, user.id);
      setAvatarUrl(publicUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateLoading(true);

    try {
      await updateUserProfile({
        username: username.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCancel = () => {
    setUsername(profile.username);
    setAvatarUrl(profile.avatar_url || '');
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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
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
                  <div className="mt-1 space-y-4">
                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => setIsUrlMode(true)}
                        className={`flex-1 inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                          isUrlMode
                            ? 'border-brand-primary text-brand-primary bg-white dark:bg-gray-700'
                            : 'border-gray-300 text-gray-700 bg-white dark:border-gray-600 dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <HiLink className="-ml-1 mr-2 h-5 w-5" />
                        URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUrlMode(false);
                          fileInputRef.current?.click();
                        }}
                        className={`flex-1 inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                          !isUrlMode
                            ? 'border-brand-primary text-brand-primary bg-white dark:bg-gray-700'
                            : 'border-gray-300 text-gray-700 bg-white dark:border-gray-600 dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <HiUpload className="-ml-1 mr-2 h-5 w-5" />
                        Upload
                      </button>
                    </div>

                    {isUrlMode ? (
                      <input
                        type="text"
                        name="avatar"
                        id="avatar"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="Enter image URL"
                        className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                          <div className="space-y-1 text-center">
                            <HiUpload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-brand-primary hover:text-brand-secondary"
                              >
                                Click to upload
                              </button>
                              {' or drag and drop'}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              PNG, JPG, GIF up to 5MB
                            </p>
                            {updateLoading ? (
                              <p className="text-xs text-blue-500">Uploading image...</p>
                            ) : avatarUrl && (
                              <p className="text-xs text-green-500">Image uploaded successfully</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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
                    <img
                      src={profile.avatar_url}
                      alt="Profile avatar"
                      className="mt-1 h-20 w-20 rounded-full"
                    />
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
      </div>
    </div>
  );
};
