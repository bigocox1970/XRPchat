import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HiBell, 
  HiEye, 
  HiEyeOff, 
  HiShieldCheck, 
  HiUser, 
  HiArrowLeft,
  HiClock,
  HiRefresh
} from 'react-icons/hi';
import { useUser } from '../context/UserContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useDebugMode } from '../context/DebugModeContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/DarkModeContext';
import { supabase } from '../utils/supabase/client';
import { saveAutoDeleteSettingsToDatabase, loadAutoDeleteSettingsFromDatabase } from '../utils/supabase/autoDelete';

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
  const { ThemeToggle, isNaturalTheme } = useTheme();
  const { user, signOut, refreshProfile } = useUser();
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
    updateNotificationState,
    playNotificationSound,
    subscribeToPush,
    unsubscribeFromPush
  } = useNotification();

  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(notificationsEnabled);
  const [autoDeleteSettings, setAutoDeleteSettings] = useState<AutoDeleteSettings>({
    enabled: false,
    option: 'off',
    customValue: 24,
    customUnit: 'hours'
  });
  const [saveSettingsMessage, setSaveSettingsMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  // Add state to track refreshing
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Feature toggles with default ON
  const [imageFilesEnabled, setImageFilesEnabled] = useState(() => {
    const val = localStorage.getItem('xrpchat_feature_image_files');
    if (val === null) {
      localStorage.setItem('xrpchat_feature_image_files', 'true');
      return true;
    }
    return val === 'true';
  });
  const [videoFilesEnabled, setVideoFilesEnabled] = useState(() => {
    const val = localStorage.getItem('xrpchat_feature_video_files');
    if (val === null) {
      localStorage.setItem('xrpchat_feature_video_files', 'true');
      return true;
    }
    return val === 'true';
  });
  const [audioFilesEnabled, setAudioFilesEnabled] = useState(() => {
    const val = localStorage.getItem('xrpchat_feature_audio_files');
    if (val === null) {
      localStorage.setItem('xrpchat_feature_audio_files', 'true');
      return true;
    }
    return val === 'true';
  });
  // Add state for live typing feed toggle
  const [liveTypingEnabled, setLiveTypingEnabled] = useState(() => {
    const val = localStorage.getItem('xrpchat_feature_live_typing');
    if (val === null) {
      localStorage.setItem('xrpchat_feature_live_typing', 'true');
      return true;
    }
    return val === 'true';
  });

  // Load auto-delete settings from localStorage on mount
  useEffect(() => {
    loadSettingsFromLocalStorage();
  }, []);

  // Load settings function that can be reused for refresh
  const loadSettingsFromLocalStorage = () => {
    console.log('Loading settings from localStorage');
    const savedSettings = localStorage.getItem('xrpchat_auto_delete_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings) as AutoDeleteSettings;
        setAutoDeleteSettings(parsedSettings);
      } catch (e) {
        console.error('Error parsing auto-delete settings:', e);
      }
    }
    
    // Also update notification state from localStorage
    const notificationsEnabledInStorage = localStorage.getItem('xrpchat_notifications_enabled') === 'true';
    setLocalNotificationsEnabled(notificationsEnabledInStorage);
  };

  // Add event listener for app-refresh events
  useEffect(() => {
    const handleAppRefresh = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const path = customEvent.detail?.path;
      
      // Only refresh if we're on the settings page
      if (path && path === '/app/settings') {
        console.log('Refreshing settings page due to refresh event');
        setIsRefreshing(true);
        
        try {
          // Refresh user profile data
          if (refreshProfile) {
            await refreshProfile();
          }
          
          // Refresh auto-delete settings
          if (user) {
            try {
              const success = await loadAutoDeleteSettingsFromDatabase(user.id);
              if (success) {
                console.log('Auto-delete settings refreshed from database');
              }
            } catch (error) {
              console.error('Error refreshing auto-delete settings:', error);
            }
          }
          
          // Reload settings from localStorage (which would have been updated by the database load)
          loadSettingsFromLocalStorage();
          
          // Update notification state
          updateNotificationState();
          
          // Add a small delay to show feedback
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error refreshing settings:', error);
        } finally {
          setIsRefreshing(false);
        }
      }
    };
    
    // Add event listener
    window.addEventListener('app-refresh', handleAppRefresh);
    
    // Cleanup
    return () => {
      window.removeEventListener('app-refresh', handleAppRefresh);
    };
  }, [user, refreshProfile, updateNotificationState]);

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
      // Subscribe to push notifications
      try {
        await subscribeToPush();
      } catch (err) {
        console.error('Failed to subscribe to push notifications:', err);
      }
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
      // Unsubscribe from push notifications
      try {
        await unsubscribeFromPush();
      } catch (err) {
        console.error('Failed to unsubscribe from push notifications:', err);
      }
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

  // Add a function to reset notification permissions
  const resetNotificationPermissions = () => {
    // Clear saved preference
    localStorage.removeItem('xrpchat_notification_permission');
    localStorage.removeItem('xrpchat_notification_requested');
    // Request permissions again
    requestNotificationPermission();
  };

  // Add test notification sound function
  const testNotificationSound = () => {
    playNotificationSound();
  };

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900 natural-light:bg-natural-background natural-dark:bg-natural-dark-background">
      {/* Header */}
      <div className="bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="font-semibold">Settings</div>
          </div>
        </div>
        
        {/* Add refresh indicator */}
        {isRefreshing && (
          <div className="flex items-center text-white">
            <HiRefresh className="animate-spin mr-2" size={20} />
            <span className="text-sm">Refreshing...</span>
          </div>
        )}
      </div>

      {/* Refresh indicator toast when settings are being refreshed */}
      {isRefreshing && (
        <div className="fixed top-16 right-4 z-50 bg-green-100 dark:bg-green-900 p-2 rounded-lg shadow-lg border border-green-200 dark:border-green-700 max-w-sm">
          <div className="flex items-center space-x-2">
            <HiRefresh className="text-green-500 dark:text-green-400 animate-spin" size={20} />
            <div className="text-sm text-green-700 dark:text-green-300">
              Refreshing settings...
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-full bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-6">
              {/* Appearance Section */}
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-white natural-light:text-natural-text natural-dark:text-natural-dark-text">
                  Appearance
                </h2>
                
                <div className="px-4 py-4 bg-white dark:bg-gray-800 natural-light:bg-natural-paper natural-dark:bg-natural-dark-paper rounded-md shadow-sm mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 natural-light:text-natural-text natural-dark:text-natural-dark-text">
                        Theme
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 natural-light:text-natural-muted natural-dark:text-natural-dark-muted">
                        {isNaturalTheme 
                          ? "Using natural theme with warm, earthy colors." 
                          : "Using default theme with standard colors."}
                      </div>
                    </div>
                    <ThemeToggle />
                  </div>
                </div>
              </div>

              {/* Show Encrypted Data */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Show Encrypted Data</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Show encrypted format of messages in debug view
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-encryption"
                    checked={showEncrypted}
                    onChange={toggleEncryptionMode}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-encryption"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      showEncrypted ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        showEncrypted ? "translate-x-4" : "translate-x-0"
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              {/* Debug Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Debug Mode</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Show additional debug information
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-debug"
                    checked={debugMode}
                    onChange={toggleDebugMode}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-debug"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      debugMode ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        debugMode ? "translate-x-4" : "translate-x-0"
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              {/* Maximum Security Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Maximum Security Mode</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Extra encryption for all messages (may impact performance)
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-max-security"
                    checked={isMaxSecurityEnabled}
                    onChange={handleToggleMaxSecurity}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-max-security"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      isMaxSecurityEnabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        isMaxSecurityEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              {/* Notifications */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Receive alerts for new messages
                    </p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="toggle-notifications"
                      checked={localNotificationsEnabled}
                      onChange={handleToggleNotifications}
                      className="sr-only"
                    />
                    <label
                      htmlFor="toggle-notifications"
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                        localNotificationsEnabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                          localNotificationsEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>
                
                {/* Notification permission status and buttons */}
                <div className="mt-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                  <div className="text-sm mb-2">
                    {/* Status indicator */}
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-2 ${
                        notificationPermission === 'granted' ? 'natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500' : 
                        notificationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                      <span className="text-gray-600 dark:text-gray-400">
                        {notificationPermission === 'granted' ? 'Permission granted' : 
                        notificationPermission === 'denied' ? 'Permission denied' : 'Permission not set'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {notificationPermission !== 'granted' && (
                      <button
                        onClick={requestNotificationPermission}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                      >
                        <HiBell className="h-4 w-4 mr-1.5" />
                        Request Permission
                      </button>
                    )}
                    
                    <button
                      onClick={testNotificationSound}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                    >
                      <HiBell className="h-4 w-4 mr-1.5" />
                      Test Sound
                    </button>
                    
                    <button
                      onClick={resetNotificationPermissions}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                    >
                      <HiRefresh className="h-4 w-4 mr-1.5" />
                      Reset Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Card */}
              <div className="max-w-full bg-white dark:bg-gray-800 shadow rounded-lg mb-6 mt-8">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-6">Features</h3>
                  <div className="space-y-6">
                    {/* Live Typing Feed */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Live Typing Feed</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Show what the other user is typing in real time (instead of just 'is typing...')
                        </p>
                      </div>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input
                          type="checkbox"
                          id="toggle-live-typing"
                          checked={liveTypingEnabled}
                          onChange={e => {
                            setLiveTypingEnabled(e.target.checked);
                            localStorage.setItem('xrpchat_feature_live_typing', e.target.checked ? 'true' : 'false');
                            window.dispatchEvent(new Event('storage'));
                          }}
                          className="sr-only"
                        />
                        <label
                          htmlFor="toggle-live-typing"
                          className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                            liveTypingEnabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                              liveTypingEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          ></span>
                        </label>
                      </div>
                    </div>
                    {/* Allow Image Files */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Allow Image Files</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Enable sending and receiving image files in chat
                        </p>
                      </div>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input
                          type="checkbox"
                          id="toggle-image-files"
                          checked={imageFilesEnabled}
                          onChange={e => {
                            setImageFilesEnabled(e.target.checked);
                            localStorage.setItem('xrpchat_feature_image_files', e.target.checked ? 'true' : 'false');
                            window.dispatchEvent(new Event('storage'));
                          }}
                          className="sr-only"
                        />
                        <label
                          htmlFor="toggle-image-files"
                          className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                            imageFilesEnabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                              imageFilesEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          ></span>
                        </label>
                      </div>
                    </div>
                    {/* Allow Video Files */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Allow Video Files</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Enable sending and receiving video files in chat
                        </p>
                      </div>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input
                          type="checkbox"
                          id="toggle-video-files"
                          checked={videoFilesEnabled}
                          onChange={e => {
                            setVideoFilesEnabled(e.target.checked);
                            localStorage.setItem('xrpchat_feature_video_files', e.target.checked ? 'true' : 'false');
                            window.dispatchEvent(new Event('storage'));
                          }}
                          className="sr-only"
                        />
                        <label
                          htmlFor="toggle-video-files"
                          className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                            videoFilesEnabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                              videoFilesEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          ></span>
                        </label>
                      </div>
                    </div>
                    {/* Allow Audio Files */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Allow Audio Files</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Enable sending and receiving audio files in chat
                        </p>
                      </div>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input
                          type="checkbox"
                          id="toggle-audio-files"
                          checked={audioFilesEnabled}
                          onChange={e => {
                            setAudioFilesEnabled(e.target.checked);
                            localStorage.setItem('xrpchat_feature_audio_files', e.target.checked ? 'true' : 'false');
                            window.dispatchEvent(new Event('storage'));
                          }}
                          className="sr-only"
                        />
                        <label
                          htmlFor="toggle-audio-files"
                          className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                            audioFilesEnabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                              audioFilesEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          ></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-delete Settings */}
        <div className="max-w-full bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-6">Message Auto-Delete</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Auto-Delete Messages</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically delete messages after a set time
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Current setting: <span className="font-medium">{getAutoDeleteText()}</span>
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-auto-delete"
                    checked={autoDeleteSettings.enabled}
                    onChange={() => {
                      const newSettings = {
                        ...autoDeleteSettings,
                        enabled: !autoDeleteSettings.enabled,
                        option: !autoDeleteSettings.enabled 
                          ? (autoDeleteSettings.option === 'off' ? '1day' as AutoDeleteOption : autoDeleteSettings.option) 
                          : 'off' as AutoDeleteOption
                      };
                      setAutoDeleteSettings(newSettings);
                      saveAutoDeleteSettings(newSettings);
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-auto-delete"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      autoDeleteSettings.enabled ? "natural-light:bg-natural-toggle-active natural-dark:bg-natural-toggle-active-dark bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        autoDeleteSettings.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    ></span>
                  </label>
                </div>
              </div>
              
              {/* Auto-delete options */}
              {autoDeleteSettings.enabled && (
                <div className="pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAutoDeleteOptionChange('5min')}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center justify-center ${
                        autoDeleteSettings.option === '5min'
                          ? 'natural-light:!bg-natural-button-active-bg natural-dark:!bg-natural-button-active-bg-dark natural-light:!text-white natural-dark:!text-white bg-green-100 dark:bg-green-800 text-white dark:text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      5 minutes
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('30min')}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center justify-center ${
                        autoDeleteSettings.option === '30min'
                          ? 'natural-light:!bg-natural-button-active-bg natural-dark:!bg-natural-button-active-bg-dark natural-light:!text-white natural-dark:!text-white bg-green-100 dark:bg-green-800 text-white dark:text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      30 minutes
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('1hour')}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center justify-center ${
                        autoDeleteSettings.option === '1hour'
                          ? 'natural-light:!bg-natural-button-active-bg natural-dark:!bg-natural-button-active-bg-dark natural-light:!text-white natural-dark:!text-white bg-green-100 dark:bg-green-800 text-white dark:text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      1 hour
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('1day')}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center justify-center ${
                        autoDeleteSettings.option === '1day'
                          ? 'natural-light:!bg-natural-button-active-bg natural-dark:!bg-natural-button-active-bg-dark natural-light:!text-white natural-dark:!text-white bg-green-100 dark:bg-green-800 text-white dark:text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      1 day
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('1week')}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center justify-center ${
                        autoDeleteSettings.option === '1week'
                          ? 'natural-light:!bg-natural-button-active-bg natural-dark:!bg-natural-button-active-bg-dark natural-light:!text-white natural-dark:!text-white bg-green-100 dark:bg-green-800 text-white dark:text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      1 week
                    </button>
                    <button
                      onClick={() => handleAutoDeleteOptionChange('custom')}
                      className={`px-3 py-1.5 text-sm rounded-md flex items-center justify-center ${
                        autoDeleteSettings.option === 'custom'
                          ? 'natural-light:!bg-natural-button-active-bg natural-dark:!bg-natural-button-active-bg-dark natural-light:!text-white natural-dark:!text-white bg-green-100 dark:bg-green-800 text-white dark:text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  
                  {/* Custom auto-delete settings */}
                  {autoDeleteSettings.option === 'custom' && (
                    <div className="flex items-center mt-3">
                      <input
                        type="number"
                        min="1"
                        value={autoDeleteSettings.customValue}
                        onChange={handleCustomValueChange}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md mr-2"
                      />
                      <select
                        value={autoDeleteSettings.customUnit}
                        onChange={handleCustomUnitChange}
                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-2 py-1"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                    </div>
                  )}
                  
                  {/* Info about how auto-delete works */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <p>Messages older than the specified time will be permanently deleted from all devices.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Toast notification for settings updates */}
        {saveSettingsMessage && (
          <div className={`fixed bottom-4 right-4 rounded-lg shadow-lg px-4 py-3 text-sm ${
            saveSettingsMessage.type === 'success' 
              ? 'natural-light:bg-natural-button-active-bg natural-dark:bg-natural-button-active-bg-dark natural-light:text-natural-button-active-text natural-dark:text-natural-button-active-text-dark natural-light:border-natural-border natural-dark:border-natural-dark-border bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}>
            {saveSettingsMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}; 