import { gun, getConnectionStatus } from './client';
import { GunMessage, GunThread } from './chat';
import { updateUserPresence } from './realtime';
import { getCurrentGunUser } from './auth';

// Queue for storing messages when offline
interface QueuedMessage {
  id: string;
  threadId: string;
  message: GunMessage;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

// Local storage keys
const QUEUED_MESSAGES_KEY = 'gun_queued_messages';
const OFFLINE_STATUS_KEY = 'gun_offline_status';

// In-memory queue for real-time operations
let messageQueue: QueuedMessage[] = [];
let isOffline = false;
let offlineCheckInterval: NodeJS.Timeout | null = null;

/**
 * Initialize offline handling
 */
export const initializeOfflineHandling = () => {
  // Load queued messages from localStorage
  loadQueuedMessagesFromStorage();
  
  // Start monitoring connection status
  startConnectionMonitoring();
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Handle online/offline events
  window.addEventListener('online', handleOnlineEvent);
  window.addEventListener('offline', handleOfflineEvent);
  
  console.log('Gun offline handling initialized');
};

/**
 * Cleanup offline handling
 */
export const cleanupOfflineHandling = () => {
  if (offlineCheckInterval) {
    clearInterval(offlineCheckInterval);
    offlineCheckInterval = null;
  }
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnlineEvent);
  window.removeEventListener('offline', handleOfflineEvent);
};

/**
 * Check if currently offline
 */
export const isCurrentlyOffline = (): boolean => {
  const connectionStatus = getConnectionStatus();
  return !navigator.onLine || !connectionStatus.isConnected;
};

/**
 * Queue a message for sending when online
 */
export const queueMessageForOffline = (
  threadId: string,
  message: GunMessage,
  maxRetries: number = 3
): void => {
  const queuedMessage: QueuedMessage = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    threadId,
    message,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    maxRetries
  };
  
  messageQueue.push(queuedMessage);
  saveQueuedMessagesToStorage();
  
  console.log('Message queued for offline sending:', queuedMessage.id);
};

/**
 * Process queued messages when coming online
 */
export const processQueuedMessages = async (): Promise<void> => {
  if (messageQueue.length === 0) {
    return;
  }
  
  console.log(`Processing ${messageQueue.length} queued messages`);
  
  const currentUser = getCurrentGunUser();
  if (!currentUser) {
    console.warn('No authenticated user, cannot process queued messages');
    return;
  }
  
  const messagesToRemove: string[] = [];
  
  for (const queuedMessage of messageQueue) {
    try {
      // Attempt to send the message
      await sendQueuedMessage(queuedMessage);
      messagesToRemove.push(queuedMessage.id);
      console.log('Successfully sent queued message:', queuedMessage.id);
    } catch (error) {
      queuedMessage.retryCount++;
      console.error(`Failed to send queued message (attempt ${queuedMessage.retryCount}):`, error);
      
      if (queuedMessage.retryCount >= queuedMessage.maxRetries) {
        messagesToRemove.push(queuedMessage.id);
        console.error('Max retries reached, removing message from queue:', queuedMessage.id);
      }
    }
  }
  
  // Remove successfully sent or failed messages from queue
  messageQueue = messageQueue.filter(msg => !messagesToRemove.includes(msg.id));
  saveQueuedMessagesToStorage();
};

/**
 * Send a queued message
 */
const sendQueuedMessage = async (queuedMessage: QueuedMessage): Promise<void> => {
  const { threadId, message } = queuedMessage;
  
  // Store message in Gun
  gun.get('thread_messages').get(threadId).get(message.id).put(message);
  gun.get('message').get(message.id).put(message);
  
  // Update thread's last message time
  gun.get('thread').get(threadId).get('last_message_at').put(message.created_at);
};

/**
 * Sync data when coming back online
 */
export const syncOfflineData = async (): Promise<void> => {
  try {
    console.log('Syncing offline data...');
    
    // Process queued messages
    await processQueuedMessages();
    
    // Update user presence to online
    const currentUser = getCurrentGunUser();
    if (currentUser) {
      updateUserPresence(currentUser.is, true);
    }
    
    // Load any messages that arrived while offline
    await loadOfflineMessages();
    
    console.log('Offline data sync completed');
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
};

/**
 * Load messages that arrived while offline
 */
const loadOfflineMessages = async (): Promise<void> => {
  const currentUser = getCurrentGunUser();
  if (!currentUser) {
    return;
  }
  
  // Check inbox for messages received while offline
  const userPublicKey = currentUser.is.pub;
  
  gun.get('inbox').get(userPublicKey).map().once((message: GunMessage) => {
    if (message && message.id) {
      console.log('Found offline message:', message.id);
      
      // Move message to appropriate thread
      gun.get('thread_messages').get(message.thread_id).get(message.id).put(message);
      
      // Remove from inbox
      gun.get('inbox').get(userPublicKey).get(message.id).put(null);
    }
  });
};

/**
 * Save queued messages to localStorage
 */
const saveQueuedMessagesToStorage = (): void => {
  try {
    localStorage.setItem(QUEUED_MESSAGES_KEY, JSON.stringify(messageQueue));
  } catch (error) {
    console.error('Error saving queued messages to storage:', error);
  }
};

/**
 * Load queued messages from localStorage
 */
const loadQueuedMessagesFromStorage = (): void => {
  try {
    const stored = localStorage.getItem(QUEUED_MESSAGES_KEY);
    if (stored) {
      messageQueue = JSON.parse(stored);
      console.log(`Loaded ${messageQueue.length} queued messages from storage`);
    }
  } catch (error) {
    console.error('Error loading queued messages from storage:', error);
    messageQueue = [];
  }
};

/**
 * Start monitoring connection status
 */
const startConnectionMonitoring = (): void => {
  offlineCheckInterval = setInterval(() => {
    const wasOffline = isOffline;
    isOffline = isCurrentlyOffline();
    
    if (wasOffline && !isOffline) {
      // Just came back online
      handleComingOnline();
    } else if (!wasOffline && isOffline) {
      // Just went offline
      handleGoingOffline();
    }
  }, 2000); // Check every 2 seconds
};

/**
 * Handle coming back online
 */
const handleComingOnline = async (): Promise<void> => {
  console.log('Connection restored, syncing offline data');
  
  // Update offline status
  localStorage.setItem(OFFLINE_STATUS_KEY, 'false');
  
  // Sync offline data
  await syncOfflineData();
  
  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('gun-online'));
};

/**
 * Handle going offline
 */
const handleGoingOffline = (): void => {
  console.log('Connection lost, entering offline mode');
  
  // Update offline status
  localStorage.setItem(OFFLINE_STATUS_KEY, 'true');
  
  const currentUser = getCurrentGunUser();
  if (currentUser) {
    updateUserPresence(currentUser.is, false);
  }
  
  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('gun-offline'));
};

/**
 * Handle page visibility changes
 */
const handleVisibilityChange = (): void => {
  const currentUser = getCurrentGunUser();
  if (!currentUser) return;
  
  if (document.hidden) {
    // Page is hidden, update presence to away
    updateUserPresence(currentUser.is, false);
  } else {
    // Page is visible, update presence to online
    updateUserPresence(currentUser.is, true);
    
    // Sync any data that might have been missed
    if (!isCurrentlyOffline()) {
      syncOfflineData();
    }
  }
};

/**
 * Handle browser online event
 */
const handleOnlineEvent = (): void => {
  console.log('Browser online event detected');
  // The connection monitoring will handle the actual sync
};

/**
 * Handle browser offline event
 */
const handleOfflineEvent = (): void => {
  console.log('Browser offline event detected');
  // The connection monitoring will handle the offline state
};

/**
 * Get queued message count
 */
export const getQueuedMessageCount = (): number => {
  return messageQueue.length;
};

/**
 * Get offline status
 */
export const getOfflineStatus = (): {
  isOffline: boolean;
  queuedMessages: number;
  lastSync: string | null;
} => {
  const lastSync = localStorage.getItem('gun_last_sync');
  
  return {
    isOffline: isCurrentlyOffline(),
    queuedMessages: messageQueue.length,
    lastSync
  };
};

/**
 * Force sync (for manual retry)
 */
export const forceSyncOfflineData = async (): Promise<void> => {
  if (isCurrentlyOffline()) {
    throw new Error('Cannot sync while offline');
  }
  
  await syncOfflineData();
  localStorage.setItem('gun_last_sync', new Date().toISOString());
};