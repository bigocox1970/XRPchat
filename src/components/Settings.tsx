import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HiBell, 
  HiEye, 
  HiEyeOff, 
  HiShieldCheck, 
  HiUser, 
  HiArrowLeft,
  HiTrash,
  HiClock,
  HiRefresh
} from 'react-icons/hi';
import { useUser } from '../context/UserContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useDebugMode } from '../context/DebugModeContext';
import { useNotification } from '../context/NotificationContext';
import { supabase } from '../utils/supabase/client';
import { saveAutoDeleteSettingsToDatabase } from '../utils/supabase/autoDelete';

// Auto-delete option types
type AutoDeleteTimeUnit = 'minutes' | 'hours' | 'days' | 'weeks';
type AutoDeleteOption = 'off' | '5min' | '30min' | '1hour' | '1day' | '1week' | 'custom';

interface AutoDeleteSettings {
  enabled: boolean;
  option: AutoDeleteOption;
  customValue: number;
  customUnit: AutoDeleteTimeUnit;
}

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { DarkModeToggle } = useDarkMode();
  const { user, signOut } = useUser();
  const { 
    showEncrypted, 
    toggleEncryptionMode, 
    isMaxSecurityEnabled, 
    enableMaxSecurity, 
    disableMaxSecurity 
  } = useEncryptionMode();
  const { debugMode, toggleDebugMode } = useDebugMode();
  const { 
    notificationsEnabled, 
    notificationPermission,
    requestNotificationPermission,
    updateNotificationState
  } = useNotification();

  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(notificationsEnabled);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [burnLoading, setBurnLoading] = useState(false);
  const [burnError, setBurnError] = useState<string | null>(null);
  const [autoDeleteSettings, setAutoDeleteSettings] = useState<AutoDeleteSettings>({
    enabled: false,
    option: 'off',
    customValue: 24,
    customUnit: 'hours'
  });
  const [saveSettingsMessage, setSaveSettingsMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Load auto-delete settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('xrpchat_auto_delete_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings) as AutoDeleteSettings;
        setAutoDeleteSettings(parsedSettings);
      } catch (e) {
        console.error('Error parsing auto-delete settings:', e);
      }
    }
  }, []);

  // Initialize local state based on the context value
  useEffect(() => {
    // Check localStorage first for the most accurate state
    const notificationsEnabledInStorage = localStorage.getItem('xrpchat_notifications_enabled') === 'true';
    // If there's a difference between context and localStorage, prefer localStorage
    if (notificationsEnabledInStorage !== notificationsEnabled) {
      console.log('Notification state differs between localStorage and context, using localStorage value');
      setLocalNotificationsEnabled(notificationsEnabledInStorage);
    } else {
      setLocalNotificationsEnabled(notificationsEnabled);
    }
  }, [notificationsEnabled]);

  // Handle toggling notifications
  const handleToggleNotifications = async () => {
    // Toggle the local state first for immediate UI feedback
    const newEnabledState = !localNotificationsEnabled;
    setLocalNotificationsEnabled(newEnabledState);
    
    if (newEnabledState) {
      // User wants to enable notifications
      console.log('User is enabling notifications from settings');
      
      // Update localStorage values to enable notifications
      localStorage.setItem('xrpchat_notification_user_choice', 'true');
      localStorage.setItem('xrpchat_notification_permission', 'granted');
      localStorage.setItem('xrpchat_notifications_enabled', 'true');
      
      // Show a toast message to confirm the change
      setSaveSettingsMessage({
        type: 'success',
        text: 'Notifications enabled - new messages will trigger notifications when the app is in the background'
      });
    } else {
      // User wants to disable notifications
      console.log('User is disabling notifications from settings');
      
      // Update localStorage values to disable notifications
      localStorage.setItem('xrpchat_notification_permission', 'disabled');
      localStorage.setItem('xrpchat_notification_user_choice', 'false');
      localStorage.setItem('xrpchat_notifications_enabled', 'false');
      
      // Show a toast message to confirm the change
      setSaveSettingsMessage({
        type: 'success',
        text: 'Notifications disabled - you won\'t receive alerts for new messages'
      });
    }
    
    // Force update of the notification context state to match localStorage
    updateNotificationState();
    
    // Clear toast after 3 seconds
    setTimeout(() => {
      setSaveSettingsMessage(null);
    }, 3000);
    
    // Manually dispatch a storage event to trigger listeners in other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'xrpchat_notifications_enabled',
      newValue: newEnabledState ? 'true' : 'false'
    }));
  };

  // Toggle maximum security mode
  const handleToggleMaxSecurity = () => {
    if (isMaxSecurityEnabled) {
      disableMaxSecurity();
    } else {
      enableMaxSecurity();
    }
  };

  // Handle auto-delete option change
  const handleAutoDeleteOptionChange = (option: AutoDeleteOption) => {
    const updatedSettings = {
      ...autoDeleteSettings,
      option,
      enabled: option !== 'off'
    };
    setAutoDeleteSettings(updatedSettings);
    saveAutoDeleteSettings(updatedSettings);
  };

  // Handle custom auto-delete value change
  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      const updatedSettings = {
        ...autoDeleteSettings,
        customValue: value
      };
      setAutoDeleteSettings(updatedSettings);
      saveAutoDeleteSettings(updatedSettings);
    }
  };

  // Handle custom auto-delete unit change
  const handleCustomUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value as AutoDeleteTimeUnit;
    const updatedSettings = {
      ...autoDeleteSettings,
      customUnit: unit
    };
    setAutoDeleteSettings(updatedSettings);
    saveAutoDeleteSettings(updatedSettings);
  };

  // Save auto-delete settings to localStorage and database
  const saveAutoDeleteSettings = (settings: AutoDeleteSettings) => {
    try {
      // Save to localStorage
      localStorage.setItem('xrpchat_auto_delete_settings', JSON.stringify(settings));
      
      // Also save to database so other users can see the settings
      if (user) {
        setSaveSettingsMessage({
          type: 'success',
          text: 'Saving auto-delete settings...'
        });
        
        saveAutoDeleteSettingsToDatabase(user.id, settings)
          .then(success => {
            if (success) {
              setSaveSettingsMessage({
                type: 'success',
                text: 'Auto-delete settings saved successfully to server.'
              });
            } else {
              setSaveSettingsMessage({
                type: 'error',
                text: 'Saved to local device but failed to sync to server.'
              });
            }
            
            // Clear success message after 3 seconds
            setTimeout(() => {
              setSaveSettingsMessage(null);
            }, 3000);
          })
          .catch(error => {
            console.error('Error saving auto-delete settings to database:', error);
            setSaveSettingsMessage({
              type: 'error',
              text: 'Failed to save settings to server: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
          });
      } else {
        setSaveSettingsMessage({
          type: 'success',
          text: 'Auto-delete settings saved to local device only.'
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveSettingsMessage(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving auto-delete settings:', error);
      setSaveSettingsMessage({
        type: 'error',
        text: 'Failed to save auto-delete settings.'
      });
    }
  };

  // Convert auto-delete settings to human-readable text
  const getAutoDeleteText = () => {
    if (!autoDeleteSettings.enabled || autoDeleteSettings.option === 'off') {
      return 'Off';
    }
    
    switch (autoDeleteSettings.option) {
      case '5min':
        return '5 minutes';
      case '30min':
        return '30 minutes';
      case '1hour':
        return '1 hour';
      case '1day':
        return '1 day';
      case '1week':
        return '1 week';
      case 'custom':
        return `${autoDeleteSettings.customValue} ${autoDeleteSettings.customUnit}`;
      default:
        return 'Off';
    }
  };

  // Handle burn wallet confirmation
  const handleBurnConfirm = () => {
    setShowBurnConfirm(true);
    setBurnError(null);
  };

  // Handle burn wallet action
  const handleBurnWallet = async () => {
    if (!user) return;
    
    setBurnLoading(true);
    setBurnError(null);
    
    try {
      // 1. Delete all messages associated with the user's wallet
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', user.id);
      
      if (messagesError) throw new Error(`Error deleting messages: ${messagesError.message}`);
      
      // 2. Delete all threads where the user is a participant
      const { error: threadsError } = await supabase
        .from('threads')
        .delete()
        .eq('created_by', user.id);
        
      if (threadsError) throw new Error(`Error deleting threads: ${threadsError.message}`);
      
      // 3. Delete wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .delete()
        .eq('profile_id', user.id);
        
      if (walletError) throw new Error(`Error deleting wallet: ${walletError.message}`);
      
      // 4. Delete contacts
      const { error: contactsError } = await supabase
        .from('contacts')
        .delete()
        .or(`user_id.eq.${user.id},contact_id.eq.${user.id}`);
        
      if (contactsError) throw new Error(`Error deleting contacts: ${contactsError.message}`);
      
      // 5. Sign the user out
      await signOut();
      
      // Navigate to login page
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error burning wallet:', error);
      setBurnError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setBurnLoading(false);
      setShowBurnConfirm(false);
    }
  };

  // Add a function to reset notification permissions
  const resetNotificationPermissions = () => {
    // Clear saved preference
    localStorage.removeItem('xrpchat_notification_permission');
    localStorage.removeItem('xrpchat_notification_requested');
    // Request permissions again
    requestNotificationPermission();
  };

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900 overflow-auto">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label="Go back"
          >
            <HiArrowLeft size={20} />
          </button>
          <div className="font-semibold">Settings</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Settings Sections */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Appearance
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-200">Theme</span>
                <DarkModeToggle />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Notifications
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <HiBell size={20} />
                  <span>Push Notifications</span>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`w-11 h-6 flex items-center rounded-full transition-colors duration-300 ${localNotificationsEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-300 ${localNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Auto-Delete Messages Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Auto-Delete Messages
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <HiClock size={20} />
                  <span>Delete messages after: <span className="font-medium">{getAutoDeleteText()}</span></span>
                </div>
                
                {saveSettingsMessage && (
                  <div className={`text-sm px-3 py-2 rounded-md ${
                    saveSettingsMessage.type === 'success' 
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                      : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  }`}>
                    {saveSettingsMessage.text}
                  </div>
                )}
                
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAutoDeleteOptionChange('off')}
                      className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                        autoDeleteSettings.option === 'off' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('5min')}
                      className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                        autoDeleteSettings.option === '5min' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      5 minutes
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('30min')}
                      className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                        autoDeleteSettings.option === '30min' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      30 minutes
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('1hour')}
                      className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                        autoDeleteSettings.option === '1hour' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      1 hour
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('1day')}
                      className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                        autoDeleteSettings.option === '1day' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      1 day
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('1week')}
                      className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                        autoDeleteSettings.option === '1week' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      1 week
                    </button>
                  </div>
                  
                  <div className="flex items-center mt-3">
                    <button
                      onClick={() => handleAutoDeleteOptionChange('custom')}
                      className={`py-2 px-3 text-xs font-medium rounded-md mr-3 transition-colors ${
                        autoDeleteSettings.option === 'custom' 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Custom
                    </button>
                    
                    <div className={`flex-1 flex items-center space-x-2 ${autoDeleteSettings.option !== 'custom' ? 'opacity-50' : ''}`}>
                      <input
                        type="number"
                        value={autoDeleteSettings.customValue}
                        onChange={handleCustomValueChange}
                        disabled={autoDeleteSettings.option !== 'custom'}
                        min="1"
                        className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                      <select
                        value={autoDeleteSettings.customUnit}
                        onChange={handleCustomUnitChange}
                        disabled={autoDeleteSettings.option !== 'custom'}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                        <option value="weeks">weeks</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Messages will be automatically deleted after the specified time. This setting applies to all your chats.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Privacy & Security
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  {!showEncrypted ? <HiEyeOff size={20} /> : <HiEye size={20} />}
                  <span>{!showEncrypted ? "Show Decrypted" : "Show Encrypted"}</span>
                </div>
                <button
                  onClick={toggleEncryptionMode}
                  className={`w-11 h-6 flex items-center rounded-full transition-colors duration-300 ${!showEncrypted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-label={!showEncrypted ? "Currently showing decrypted messages" : "Currently showing encrypted messages"}
                  title={!showEncrypted ? "Currently showing decrypted messages" : "Currently showing encrypted messages"}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-300 ${!showEncrypted ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <HiShieldCheck size={20} />
                  <span>Max Security Mode</span>
                </div>
                <button
                  onClick={handleToggleMaxSecurity}
                  className={`w-11 h-6 flex items-center rounded-full transition-colors duration-300 ${isMaxSecurityEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-label={isMaxSecurityEnabled ? "Maximum security mode enabled" : "Maximum security mode disabled"}
                  title={isMaxSecurityEnabled ? "Maximum security mode enabled" : "Maximum security mode disabled"}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-300 ${isMaxSecurityEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              
              {isMaxSecurityEnabled && (
                <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                  In maximum security mode, your private key is not stored in the browser. You'll need to provide it for each decryption operation.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Developer
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <HiUser size={20} />
                  <span>Debug Mode</span>
                </div>
                <button
                  onClick={toggleDebugMode}
                  className={`w-11 h-6 flex items-center rounded-full transition-colors duration-300 ${debugMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-300 ${debugMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Notification Settings Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Notification Settings
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <HiBell size={20} />
                  <span>Notifications</span>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`w-11 h-6 flex items-center rounded-full transition-colors duration-300 ${localNotificationsEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-label={localNotificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
                  title={localNotificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-300 ${localNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {notificationPermission === 'denied' ? (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <p className="text-red-600 dark:text-red-400">
                      Notifications are blocked by your browser. To enable them, you need to reset permissions.
                    </p>
                    <button
                      onClick={resetNotificationPermissions}
                      className="mt-2 flex items-center space-x-2 text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md text-sm"
                    >
                      <HiRefresh size={16} />
                      <span>Reset Notification Permissions</span>
                    </button>
                  </div>
                ) : (
                  <p>
                    {localNotificationsEnabled 
                      ? "You'll receive notifications when you get new messages." 
                      : "Enable notifications to be alerted when you receive new messages, even when the app is in the background."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-medium text-red-600 dark:text-red-400">
                Danger Zone
              </h3>
            </div>
            
            <div className="px-4 py-5 space-y-6">
              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <p className="mb-2">
                    <strong>Warning:</strong> Burning your wallet will permanently delete all your chat history, contacts, and wallet information. 
                    This action cannot be undone.
                  </p>
                  <p className="mb-2">
                    <strong>Note:</strong> A new wallet address will be generated for you when you log in again. You will need to share this new address with your contacts to reconnect.
                  </p>
                </div>
                
                <button
                  onClick={handleBurnConfirm}
                  className="flex items-center justify-center w-full space-x-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  <HiTrash size={20} />
                  <span>Burn Wallet Address</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Burn Wallet Confirmation Modal */}
      {showBurnConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              Burn Wallet Address
            </h3>
            
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you absolutely sure? This will permanently delete:
              <ul className="list-disc ml-6 mt-2">
                <li>All your chat messages</li>
                <li>All your contacts</li>
                <li>Your wallet information</li>
              </ul>
              <span className="block mt-2 font-semibold">This action cannot be undone.</span>
            </p>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              When you log in again, a new wallet address will be generated. You will need to share this new address with your contacts to continue chatting with them.
            </p>
            
            {burnError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
                {burnError}
              </div>
            )}
            
            <div className="flex space-x-4">
              <button
                onClick={() => setShowBurnConfirm(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-2 px-4 rounded-lg transition-colors"
                disabled={burnLoading}
              >
                Cancel
              </button>
              
              <button
                onClick={handleBurnWallet}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                disabled={burnLoading}
              >
                {burnLoading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : (
                  <HiTrash size={20} className="mr-2" />
                )}
                {burnLoading ? 'Burning...' : 'Burn My Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 