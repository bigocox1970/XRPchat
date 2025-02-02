import React, { createContext, useContext, useState, useEffect } from 'react';

interface NotificationContextType {
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(false);
      }
    }
  };

  const toggleNotifications = () => {
    if (!notificationsEnabled) {
      requestPermission();
    } else {
      setNotificationsEnabled(false);
    }
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        notificationsEnabled, 
        toggleNotifications,
        requestPermission
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
