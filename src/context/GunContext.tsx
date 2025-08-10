import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  GunUser, 
  GunProfile, 
  GunContact, 
  GunMessage, 
  GunThread,
  authenticateGunUser,
  createGunUser,
  signOutGunUser,
  getCurrentGunUser,
  updateGunProfile,
  getUserGunThreads,
  sendGunMessage,
  subscribeToGunThread,
  subscribeToGunUserThreads,
  cleanupAllGunSubscriptions,
  getConnectionStatus,
  initializeHybridMode,
  sendHybridMessage,
  createHybridThread,
  getMigrationStatus
} from '../utils/gun';

import { 
  addGunContact,
  getGunContacts 
} from '../utils/gun/contacts';

interface GunContextType {
  // Connection status
  isConnected: boolean;
  connectedPeers: number;
  
  // User management
  currentUser: GunUser | null;
  currentProfile: GunProfile | null;
  isAuthenticated: boolean;
  
  // Authentication functions
  signUp: (username: string, privateKey?: string, address?: string) => Promise<{ privateKey: string; address: string }>;
  signIn: (address: string, privateKey: string) => Promise<GunUser>;
  signOut: () => void;
  updateProfile: (updates: Partial<GunProfile>) => Promise<GunProfile>;
  
  // Contact management
  contacts: GunContact[];
  addContact: (address: string, publicKey: string, username?: string) => Promise<GunContact>;
  refreshContacts: () => Promise<void>;
  
  // Thread management
  threads: GunThread[];
  refreshThreads: () => Promise<void>;
  createThread: (name: string, participantIds: string[], createdBy: string) => Promise<GunThread>;
  
  // Message management
  sendMessage: (threadId: string, content: string, recipientPublicKey: string, type?: 'text' | 'image' | 'file') => Promise<GunMessage>;
  subscribeToThread: (threadId: string, onMessage: (message: GunMessage) => void, onUpdate?: (thread: GunThread) => void) => () => void;
  
  // Migration status
  migrationStatus: any;
  
  // Loading states
  loading: boolean;
  contactsLoading: boolean;
  threadsLoading: boolean;
  
  // Error handling
  lastError: Error | null;
  clearError: () => void;
}

const GunContext = createContext<GunContextType | undefined>(undefined);

export const GunProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState(0);
  
  // User state
  const [currentUser, setCurrentUser] = useState<GunUser | null>(null);
  const [currentProfile, setCurrentProfile] = useState<GunProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Data state
  const [contacts, setContacts] = useState<GunContact[]>([]);
  const [threads, setThreads] = useState<GunThread[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  
  // Error handling
  const [lastError, setLastError] = useState<Error | null>(null);

  // Monitor connection status with enhanced peer tracking
  useEffect(() => {
    const updateConnectionStatus = () => {
      const status = getConnectionStatus();
      setIsConnected(status.isConnected);
      setConnectedPeers(status.connectedPeers);
      
      const connectionType = status.hasRealPeers ? 'P2P + Relay' : 
                           status.isConnected ? 'Local Only' : 'Disconnected';
      
      console.log(`🔄 Gun.js status update: ${connectionType} (${status.connectedPeers} peers, ${status.hasRealPeers ? 'has relay' : 'local only'})`);
    };

    // Listen for connection events with enhanced peer info
    const handleConnectionChange = (event: CustomEvent) => {
      console.log('📡 Gun.js connection event:', event.detail);
      setIsConnected(event.detail.connected);
      setConnectedPeers(event.detail.peers);
      
      const hasRealPeers = event.detail.hasRealPeers || false;
      const connectionType = hasRealPeers ? 'P2P + Relay' : 
                           event.detail.connected ? 'Local Only' : 'Disconnected';
      
      console.log(`📡 Connection type: ${connectionType}`);
    };

    window.addEventListener('gunConnectionChange', handleConnectionChange as EventListener);

    // Check connection status every 5 seconds (reduced frequency)
    const interval = setInterval(updateConnectionStatus, 5000);
    updateConnectionStatus(); // Initial check

    return () => {
      clearInterval(interval);
      window.removeEventListener('gunConnectionChange', handleConnectionChange as EventListener);
    };
  }, []);

  // Load migration status
  useEffect(() => {
    const status = getMigrationStatus();
    setMigrationStatus(status);
  }, []);

  // Initialize hybrid mode
  useEffect(() => {
    initializeHybridMode({ enableDualWrite: true });
  }, []);

  // Authentication functions
  const signUp = async (username: string, privateKey?: string, address?: string) => {
    try {
      setLoading(true);
      setLastError(null);
      
      const result = await createGunUser(username, privateKey, address);
      setCurrentUser({
        publicKey: result.user.is.pub,
        privateKey: result.privateKey,
        address: result.address,
        username: result.profile.username,
        avatar_url: result.profile.avatar_url,
        avatar_seed: result.profile.avatar_seed,
        auto_delete_settings: result.profile.auto_delete_settings,
        last_active: result.profile.last_active
      });
      setCurrentProfile(result.profile);
      setIsAuthenticated(true);
      
      return {
        privateKey: result.privateKey,
        address: result.address
      };
    } catch (error) {
      setLastError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (address: string, privateKey: string) => {
    try {
      setLoading(true);
      setLastError(null);
      
      const user = await authenticateGunUser(address, privateKey);
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      // Load user profile from Gun if available
      const gunUser = getCurrentGunUser();
      if (gunUser) {
        gunUser.get('profile').once((profile: GunProfile) => {
          if (profile) {
            setCurrentProfile(profile);
          }
        });
      }
      
      return user;
    } catch (error) {
      setLastError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    signOutGunUser();
    cleanupAllGunSubscriptions();
    setCurrentUser(null);
    setCurrentProfile(null);
    setIsAuthenticated(false);
    setContacts([]);
    setThreads([]);
  };

  const updateProfile = async (updates: Partial<GunProfile>) => {
    try {
      const updatedProfile = await updateGunProfile(updates);
      setCurrentProfile(updatedProfile);
      
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          username: updatedProfile.username,
          avatar_url: updatedProfile.avatar_url,
          avatar_seed: updatedProfile.avatar_seed
        });
      }
      
      return updatedProfile;
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  };

  // Contact management
  const addContact = async (address: string, publicKey: string, username?: string) => {
    try {
      const contact = await addGunContact(address, publicKey, username);
      setContacts(prev => [...prev.filter(c => c.address !== address), contact]);
      return contact;
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  };

  const refreshContacts = async () => {
    try {
      setContactsLoading(true);
      const gunContacts = await getGunContacts();
      setContacts(gunContacts);
    } catch (error) {
      setLastError(error as Error);
    } finally {
      setContactsLoading(false);
    }
  };

  // Thread management
  const refreshThreads = async () => {
    if (!currentUser) return;
    
    try {
      setThreadsLoading(true);
      const gunThreads = await getUserGunThreads(currentUser.address);
      setThreads(gunThreads);
    } catch (error) {
      setLastError(error as Error);
    } finally {
      setThreadsLoading(false);
    }
  };

  const createThread = async (name: string, participantIds: string[], createdBy: string) => {
    try {
      const result = await createHybridThread(name, participantIds, createdBy);
      const thread = result.gun || result.supabase;
      
      if (thread) {
        setThreads(prev => [thread, ...prev]);
      }
      
      return thread;
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  };

  // Message management
  const sendMessage = async (
    threadId: string, 
    content: string, 
    recipientPublicKey: string, 
    type: 'text' | 'image' | 'file' = 'text'
  ) => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const result = await sendHybridMessage(
        threadId,
        currentUser.address,
        currentUser.publicKey,
        recipientPublicKey,
        content,
        type
      );
      
      const message = result.gun || result.supabase?.data;
      return message;
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  };

  const subscribeToThread = (
    threadId: string, 
    onMessage: (message: GunMessage) => void, 
    onUpdate?: (thread: GunThread) => void
  ) => {
    return subscribeToGunThread(threadId, onMessage, onUpdate);
  };

  // Load user data when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      refreshContacts();
      refreshThreads();
      
      // Subscribe to new threads
      const unsubscribe = subscribeToGunUserThreads(currentUser.address, (thread) => {
        setThreads(prev => {
          const exists = prev.find(t => t.id === thread.id);
          if (!exists) {
            return [thread, ...prev];
          }
          return prev;
        });
      });
      
      return unsubscribe;
    }
  }, [isAuthenticated, currentUser]);

  const clearError = () => setLastError(null);

  const contextValue: GunContextType = {
    // Connection status
    isConnected,
    connectedPeers,
    
    // User management
    currentUser,
    currentProfile,
    isAuthenticated,
    
    // Authentication functions
    signUp,
    signIn,
    signOut,
    updateProfile,
    
    // Contact management
    contacts,
    addContact,
    refreshContacts,
    
    // Thread management
    threads,
    refreshThreads,
    createThread,
    
    // Message management
    sendMessage,
    subscribeToThread,
    
    // Migration status
    migrationStatus,
    
    // Loading states
    loading,
    contactsLoading,
    threadsLoading,
    
    // Error handling
    lastError,
    clearError
  };

  return (
    <GunContext.Provider value={contextValue}>
      {children}
    </GunContext.Provider>
  );
};

export const useGun = (): GunContextType => {
  const context = useContext(GunContext);
  if (context === undefined) {
    throw new Error('useGun must be used within a GunProvider');
  }
  return context;
};