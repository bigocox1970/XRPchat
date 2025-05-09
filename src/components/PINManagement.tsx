import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { HiLockClosed, HiOutlineLockOpen, HiKey, HiTrash, HiRefresh } from 'react-icons/hi';
import { CopyButton } from './CopyButton';
import { setPrivateKeyAvailable, isPrivateKeyAvailable } from '../utils/privateKeyHelpers';

// Component for managing the PIN for the private key
export const PINManagement: React.FC = () => {
  const { isPINEnabled, setupPIN, updatePIN, wallet, decryptWithPIN } = useUser();

  // PIN setup state
  const [showSetupPIN, setShowSetupPIN] = useState(false);
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  // PIN update state
  const [showUpdatePIN, setShowUpdatePIN] = useState(false);
  const [currentPIN, setCurrentPIN] = useState('');
  const [newUpdatePIN, setNewUpdatePIN] = useState('');
  const [confirmUpdatePIN, setConfirmUpdatePIN] = useState('');
  const [updatePinError, setUpdatePinError] = useState<string | null>(null);
  const [updatePinSuccess, setUpdatePinSuccess] = useState(false);
  const [updatePinLoading, setUpdatePinLoading] = useState(false);

  // Private key management state
  const [showPrivateKeyManagement, setShowPrivateKeyManagement] = useState(false);
  const [privateKeyRestorePIN, setPrivateKeyRestorePIN] = useState('');
  const [privateKeyRestoreError, setPrivateKeyRestoreError] = useState<string | null>(null);
  const [privateKeyRestoreSuccess, setPrivateKeyRestoreSuccess] = useState(false);
  const [privateKeyRestoreLoading, setPrivateKeyRestoreLoading] = useState(false);
  const [localPrivateKey, setLocalPrivateKey] = useState<string | null>(null);
  const [isPrivateKeyDeleted, setIsPrivateKeyDeleted] = useState(false);

  // Handle setting up a new PIN
  const handleSetupPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);
    setPinLoading(true);

    // Validate PINs
    if (newPIN !== confirmPIN) {
      setPinError('PINs do not match');
      setPinLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(newPIN)) {
      setPinError('PIN must be exactly 6 digits');
      setPinLoading(false);
      return;
    }

    try {
      await setupPIN(newPIN);
      setPinSuccess(true);
      
      // Reset form
      setNewPIN('');
      setConfirmPIN('');
      
      // Auto-close form after success
      setTimeout(() => {
        setShowSetupPIN(false);
        setPinSuccess(false);
      }, 2000);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Failed to set up PIN');
    } finally {
      setPinLoading(false);
    }
  };

  // Handle updating an existing PIN
  const handleUpdatePIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatePinError(null);
    setUpdatePinSuccess(false);
    setUpdatePinLoading(true);

    // Validate PINs
    if (newUpdatePIN !== confirmUpdatePIN) {
      setUpdatePinError('New PINs do not match');
      setUpdatePinLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(currentPIN) || !/^\d{6}$/.test(newUpdatePIN)) {
      setUpdatePinError('PINs must be exactly 6 digits');
      setUpdatePinLoading(false);
      return;
    }

    try {
      await updatePIN(currentPIN, newUpdatePIN);
      setUpdatePinSuccess(true);
      
      // Reset form
      setCurrentPIN('');
      setNewUpdatePIN('');
      setConfirmUpdatePIN('');
      
      // Auto-close form after success
      setTimeout(() => {
        setShowUpdatePIN(false);
        setUpdatePinSuccess(false);
      }, 2000);
    } catch (error) {
      setUpdatePinError(error instanceof Error ? error.message : 'Failed to update PIN');
    } finally {
      setUpdatePinLoading(false);
    }
  };

  // Handle private key restoration
  const handleRestorePrivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrivateKeyRestoreError(null);
    setPrivateKeyRestoreSuccess(false);
    setPrivateKeyRestoreLoading(true);

    // Validate PIN
    if (!/^\d{6}$/.test(privateKeyRestorePIN)) {
      setPrivateKeyRestoreError('PIN must be exactly 6 digits');
      setPrivateKeyRestoreLoading(false);
      return;
    }

    try {
      console.log('Attempting to restore private key with PIN...');
      const decryptedKey = await decryptWithPIN(privateKeyRestorePIN);
      
      if (decryptedKey) {
        console.log('Private key successfully decrypted with PIN');
        setLocalPrivateKey(decryptedKey);
        setIsPrivateKeyDeleted(false);
        setPrivateKeyRestoreSuccess(true);
        
        // Use the helper function to set availability and notify the app
        setPrivateKeyAvailable(true);
        
        // Reset form
        setPrivateKeyRestorePIN('');
        
        // Auto-hide success message after a delay
        setTimeout(() => {
          setPrivateKeyRestoreSuccess(false);
        }, 2000);
      } else {
        console.error('decryptWithPIN returned null or empty string');
        setPrivateKeyRestoreError('Failed to decrypt private key. Incorrect PIN.');
      }
    } catch (error) {
      console.error('Error restoring private key:', error);
      setPrivateKeyRestoreError(error instanceof Error ? error.message : 'Failed to restore private key');
    } finally {
      setPrivateKeyRestoreLoading(false);
    }
  };

  // Handle locally deleting the private key
  const handleDeletePrivateKey = () => {
    if (confirm('Are you sure you want to delete your private key from this device? You will need your PIN to restore it.')) {
      setLocalPrivateKey(null);
      setIsPrivateKeyDeleted(true);
      setPrivateKeyAvailable(false);
    }
  };

  // Check initial private key status
  useEffect(() => {
    setIsPrivateKeyDeleted(!isPrivateKeyAvailable());
    
    // If wallet exists and key is available, set it
    if (wallet && wallet.private_key && isPrivateKeyAvailable()) {
      setLocalPrivateKey(wallet.private_key);
    }
  }, [wallet]);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Private Key PIN Protection</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {isPINEnabled ? (
          <span className="flex items-center">
            <HiLockClosed className="text-green-500 mr-1" />
            Your private key is protected with a 6-digit PIN
          </span>
        ) : (
          <span className="flex items-center">
            <HiOutlineLockOpen className="text-yellow-500 mr-1" />
            Your private key is not PIN-protected. For better security, set up a PIN.
          </span>
        )}
      </p>

      {/* Setup PIN Form */}
      {!isPINEnabled ? (
        !showSetupPIN ? (
          <button
            onClick={() => setShowSetupPIN(true)}
            className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
          >
            Set Up PIN Protection
          </button>
        ) : (
          <form onSubmit={handleSetupPIN} className="mt-3 space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Set Up PIN Protection
            </h5>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Create a 6-digit PIN to encrypt your private key. You'll need this PIN to decrypt messages.
            </p>
            
            <div>
              <label htmlFor="new-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New 6-Digit PIN
              </label>
              <div className="mt-1">
                <input
                  id="new-pin"
                  name="new-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={newPIN}
                  onChange={(e) => setNewPIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="Enter 6 digits"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="confirm-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm PIN
              </label>
              <div className="mt-1">
                <input
                  id="confirm-pin"
                  name="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={confirmPIN}
                  onChange={(e) => setConfirmPIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="Enter 6 digits"
                />
              </div>
            </div>
            
            {pinError && (
              <div className="text-red-600 text-sm">
                {pinError}
              </div>
            )}
            
            {pinSuccess && (
              <div className="text-green-600 text-sm">
                PIN protection enabled successfully!
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowSetupPIN(false);
                  setNewPIN('');
                  setConfirmPIN('');
                  setPinError(null);
                  setPinSuccess(false);
                }}
                className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pinLoading}
                className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 ${
                  pinLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {pinLoading ? 'Setting up...' : 'Set Up PIN'}
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="flex flex-wrap gap-2 mt-2">
          {/* Update PIN Button */}
          <button
            onClick={() => {
              setShowUpdatePIN(true);
              setShowPrivateKeyManagement(false);
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
          >
            Change PIN
          </button>

          {/* Manage Private Key Button */}
          <button
            onClick={() => {
              setShowPrivateKeyManagement(true);
              setShowUpdatePIN(false);
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
          >
            <HiKey className="mr-1.5" />
            Manage Private Key
          </button>
        </div>
      )}

      {/* Update PIN Form */}
      {isPINEnabled && showUpdatePIN && (
        <form onSubmit={handleUpdatePIN} className="mt-3 space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Change PIN
          </h5>
          
          <div>
            <label htmlFor="current-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Current PIN
            </label>
            <div className="mt-1">
              <input
                id="current-pin"
                name="current-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={currentPIN}
                onChange={(e) => setCurrentPIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                placeholder="Enter 6 digits"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="new-update-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New PIN
            </label>
            <div className="mt-1">
              <input
                id="new-update-pin"
                name="new-update-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={newUpdatePIN}
                onChange={(e) => setNewUpdatePIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                placeholder="Enter 6 digits"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="confirm-update-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm New PIN
            </label>
            <div className="mt-1">
              <input
                id="confirm-update-pin"
                name="confirm-update-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={confirmUpdatePIN}
                onChange={(e) => setConfirmUpdatePIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                placeholder="Enter 6 digits"
              />
            </div>
          </div>
          
          {updatePinError && (
            <div className="text-red-600 text-sm">
              {updatePinError}
            </div>
          )}
          
          {updatePinSuccess && (
            <div className="text-green-600 text-sm">
              PIN updated successfully!
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowUpdatePIN(false);
                setCurrentPIN('');
                setNewUpdatePIN('');
                setConfirmUpdatePIN('');
                setUpdatePinError(null);
                setUpdatePinSuccess(false);
              }}
              className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatePinLoading}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 ${
                updatePinLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {updatePinLoading ? 'Updating...' : 'Update PIN'}
            </button>
          </div>
        </form>
      )}

      {/* Private Key Management */}
      {isPINEnabled && showPrivateKeyManagement && (
        <div className="mt-3 space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Private Key Management
          </h5>
          
          {!isPrivateKeyDeleted ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your private key is currently stored on this device. Messages sent to you can be decrypted automatically.
              </p>
              
              {localPrivateKey && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Private Key
                  </label>
                  <div className="mt-1">
                    <div className="relative">
                      <textarea
                        readOnly
                        value={localPrivateKey}
                        className="font-mono text-xs shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                        rows={2}
                      />
                      <div className="absolute right-2 top-2">
                        <CopyButton text={localPrivateKey} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDeletePrivateKey}
                  className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-700 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
                >
                  <HiTrash className="mr-1.5" />
                  Delete Private Key from this Device
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Deleting your private key from this device will prevent automatic decryption of messages. You'll need to enter your PIN when viewing encrypted messages.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Your private key is not available on this device. Messages sent to you cannot be decrypted until you restore your key using your PIN.
                </p>
              </div>
              
              <form onSubmit={handleRestorePrivateKey}>
                <div>
                  <label htmlFor="restore-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enter your PIN to Restore Access
                  </label>
                  <div className="mt-1">
                    <input
                      id="restore-pin"
                      name="restore-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={privateKeyRestorePIN}
                      onChange={(e) => setPrivateKeyRestorePIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      placeholder="Enter 6 digits"
                      disabled={privateKeyRestoreLoading}
                    />
                  </div>
                </div>
                
                {privateKeyRestoreError && (
                  <div className="mt-2 text-red-600 text-sm">
                    {privateKeyRestoreError}
                  </div>
                )}
                
                {privateKeyRestoreSuccess && (
                  <div className="mt-2 text-green-600 text-sm">
                    Private key successfully restored!
                  </div>
                )}
                
                <div className="mt-4">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
                    disabled={privateKeyRestoreLoading}
                  >
                    {privateKeyRestoreLoading ? 'Restoring...' : 'Restore Private Key'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => {
                setShowPrivateKeyManagement(false);
                setPrivateKeyRestorePIN('');
                setPrivateKeyRestoreError(null);
                setPrivateKeyRestoreSuccess(false);
              }}
              className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 