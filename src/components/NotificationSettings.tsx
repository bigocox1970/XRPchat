import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { 
  testPushNotification, 
  testInAppNotification 
} from '../utils/testNotifications';
import { checkPushSubscriptionColumn } from '../utils/pushNotifications';

export const NotificationSettings: React.FC = () => {
  const { 
    notificationsEnabled, 
    pushNotificationsEnabled,
    pushNotificationsSupported,
    notificationPermission,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    playNotificationSound
  } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [columnExists, setColumnExists] = useState<boolean | null>(null);
  const [checkingColumn, setCheckingColumn] = useState(false);

  // Check if push_subscription column exists when component mounts
  useEffect(() => {
    const checkColumn = async () => {
      setCheckingColumn(true);
      try {
        const exists = await checkPushSubscriptionColumn();
        setColumnExists(exists);
        if (!exists) {
          console.warn('push_subscription column does not exist in profiles table');
        }
      } catch (error) {
        console.error('Error checking push_subscription column:', error);
      } finally {
        setCheckingColumn(false);
      }
    };

    checkColumn();
  }, []);

  const handleRequestPermission = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        setSuccess('Notification permission granted successfully!');
        
        // Test notification
        setTimeout(() => {
          playNotificationSound();
        }, 500);
      } else {
        setError('Notification permission was not granted.');
      }
    } catch (error) {
      setError('Failed to request notification permission.');
      console.error('Error requesting notification permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnablePush = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (columnExists === false) {
        setError('The push_subscription column is missing from the profiles table. Please run the SQL script first.');
        console.warn('Push notifications require the push_subscription column in the profiles table');
        setLoading(false);
        return;
      }
      
      await subscribeToPush();
      setSuccess('Push notifications enabled successfully!');
    } catch (error) {
      setError('Failed to enable push notifications.');
      console.error('Error enabling push notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await unsubscribeFromPush();
      setSuccess('Push notifications disabled successfully!');
    } catch (error) {
      setError('Failed to disable push notifications.');
      console.error('Error disabling push notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSound = () => {
    playNotificationSound();
    setSuccess('Playing notification sound...');
  };

  const handleTestPushNotification = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await testPushNotification();
      setSuccess('Test push notification sent successfully!');
    } catch (error: any) {
      setError(`Failed to send test push notification: ${error.message}`);
      console.error('Error sending test push notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestInAppNotification = () => {
    setError(null);
    setSuccess(null);
    
    try {
      testInAppNotification();
      setSuccess('Test in-app notification sent successfully!');
    } catch (error: any) {
      setError(`Failed to send test in-app notification: ${error.message}`);
      console.error('Error sending test in-app notification:', error);
    }
  };

  const renderDatabaseAlert = () => {
    if (columnExists === false) {
      return (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700 font-medium">Database Setup Required</p>
          <p className="text-sm text-yellow-600 mt-1">
            The <code className="bg-yellow-100 px-1 rounded">push_subscription</code> column is missing from your database. 
            Push notifications may not work correctly.
          </p>
          <div className="mt-2">
            <p className="text-sm text-yellow-700">To fix this, run the SQL script:</p>
            <code className="block bg-yellow-100 p-2 rounded mt-1 text-xs overflow-x-auto">
              sql/add_push_notification_column.sql
            </code>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-5">
        Notification Settings
      </h2>

      {renderDatabaseAlert()}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-md font-medium text-gray-800 dark:text-gray-200">
            Browser Notifications
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {notificationsEnabled 
              ? 'Browser notifications are enabled.' 
              : 'Enable notifications to receive alerts when new messages arrive.'}
          </p>
          {!notificationsEnabled && (
            <button
              onClick={handleRequestPermission}
              disabled={loading || notificationPermission === 'denied'}
              className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Requesting...' : 'Enable Notifications'}
            </button>
          )}
          {notificationPermission === 'denied' && (
            <p className="mt-2 text-sm text-red-500">
              Notification permission was denied. Please enable notifications in your browser settings.
            </p>
          )}
        </div>

        {pushNotificationsSupported && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-medium text-gray-800 dark:text-gray-200">
              Push Notifications
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {pushNotificationsEnabled 
                ? 'Push notifications are enabled. You will receive notifications even when the app is closed.' 
                : 'Enable push notifications to receive alerts even when the browser is closed.'}
            </p>
            {checkingColumn && (
              <p className="mt-2 text-sm text-gray-500 italic">
                Checking database support for push notifications...
              </p>
            )}
            {notificationsEnabled && (
              <button
                onClick={pushNotificationsEnabled ? handleDisablePush : handleEnablePush}
                disabled={loading || checkingColumn || columnExists === false}
                className={`mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  pushNotificationsEnabled 
                    ? 'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500'
                    : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading 
                  ? (pushNotificationsEnabled ? 'Disabling...' : 'Enabling...') 
                  : (pushNotificationsEnabled ? 'Disable Push' : 'Enable Push Notifications')}
              </button>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-medium text-gray-800 dark:text-gray-200">
            Notification Sound
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Test the notification sound to adjust your volume.
          </p>
          <button
            onClick={handleTestSound}
            className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Test Sound
          </button>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-medium text-gray-800 dark:text-gray-200">
              Testing Tools
            </h3>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showAdvanced ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Test the notification system with these tools.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={handleTestInAppNotification}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Test In-App Notification
                  </button>
                  
                  {notificationsEnabled && (
                    <button
                      onClick={handleTestPushNotification}
                      disabled={loading || columnExists === false}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sending...' : 'Test Push Notification'}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-md">
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  These test functions are for development and debugging purposes. They help verify that your notification setup is working correctly.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        <p>
          <strong>Note:</strong> To receive notifications when the app is closed:
        </p>
        <ol className="mt-2 list-decimal list-inside">
          <li>Enable browser notifications</li>
          <li>Enable push notifications</li>
          <li>Make sure your device's sound is on</li>
          <li>Keep the notification sound file in the public/sounds directory</li>
          {columnExists === false && (
            <li className="text-yellow-600 font-medium">
              Run the SQL script to add the push_subscription column to your database
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}; 