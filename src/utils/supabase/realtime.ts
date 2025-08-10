import { supabase } from './client';

// Global tracker for active subscriptions
// This helps prevent multiple components from subscribing to the same channel
export const activeSubscriptions: Record<string, boolean> = {};

// Connection health monitoring
let connectionHealth = {
  isHealthy: true,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  maxReconnectAttempts: 10
};

// Heartbeat and staleness configuration
const HEARTBEAT_INTERVAL_MS = 30000; // Send a heartbeat every 30s
const STALE_THRESHOLD_MS = 90 * 1000; // Consider stale if no activity for 90s

// Track connection status with visibility API
if (typeof document !== 'undefined') {
  // Monitor page visibility to maintain connections
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('📱 Page visible - checking Supabase connection health');
      checkAndRefreshConnections();
    }
  });
  
  // Monitor window focus for connection health
  window.addEventListener('focus', () => {
    console.log('👀 Window focused - verifying Supabase subscriptions');
    checkAndRefreshConnections();
  });
}

// Periodically check connection health
setInterval(() => {
  const timeSinceActivity = Date.now() - connectionHealth.lastActivity;
  
  // If no activity for 90s, assume connection may be stale
  if (timeSinceActivity > STALE_THRESHOLD_MS) {
    console.log('⚠️ Supabase connection inactive for >90s - health check');
    checkAndRefreshConnections();
  }
}, 30000); // Check every 30 seconds

// Function to refresh all active subscriptions
function checkAndRefreshConnections() {
  connectionHealth.lastActivity = Date.now();
  
  // If we have too many failed reconnect attempts, reset
  if (connectionHealth.reconnectAttempts > connectionHealth.maxReconnectAttempts) {
    console.log('🔄 Resetting connection health after max attempts');
    connectionHealth.reconnectAttempts = 0;
    connectionHealth.isHealthy = true;
  }
  
  // Emit event to notify components to refresh their subscriptions
  window.dispatchEvent(new CustomEvent('supabaseConnectionRefresh', {
    detail: { 
      timestamp: Date.now(),
      reconnectAttempts: connectionHealth.reconnectAttempts 
    }
  }));
}

/**
 * Sets up real-time subscriptions for a thread
 */
export const subscribeToThread = (
  threadId: string,
  onMessage: (message: any) => void,
  onUpdate: (update: any) => void
) => {
  const maxRetries = 10; // Increased from 3 to 10
  const retryDelayMs = 2000;
  let retryAttempts = 0;
  let isSubscribed = false;
  let shouldRetry = true;
  let currentChannel: any = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let staleCheckTimer: NodeJS.Timeout | null = null;

  // Check if already subscribed
  const channelKey = `thread:${threadId}`;
  if (activeSubscriptions[channelKey]) {
    console.log(`Already subscribed to ${channelKey}, skipping subscription`);
    // Return a dummy cleanup function
    return () => {
      console.log(`Unsubscribe called for already subscribed channel ${channelKey}`);
    };
  }

  // Mark as active
  activeSubscriptions[channelKey] = true;

  const createChannel = () => {
    // Clean up existing channel if any
    if (currentChannel) {
      try {
        currentChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing from existing channel:', e);
      }
    }
    
    currentChannel = supabase.channel(`thread:${threadId}`, {
      config: {
        presence: {
          key: `user-${Date.now()}` // Unique key for this session
        },
        broadcast: {
          self: true // Allow receiving own broadcasts for connection testing
        }
      }
    });
    
    return currentChannel;
  };
  
  let channel = createChannel();

  const startHeartbeat = () => {
    // Clear existing interval first
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(() => {
      if (!isSubscribed || !currentChannel) return;
      try {
        currentChannel
          .send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: { timestamp: Date.now(), threadId, seq: Math.random().toString(36).slice(2) }
          })
          .catch((e: any) => {
            console.warn('Heartbeat send failed, forcing resubscribe:', e);
            // Treat as stale and force a resubscribe
            try { currentChannel.unsubscribe(); } catch {}
            isSubscribed = false;
            retryAttempts = Math.min(retryAttempts + 1, maxRetries);
            channel = createChannel();
            setupChannelHandlers(channel);
            channel.subscribe(handleSubscribe);
          });
      } catch (e) {
        console.warn('Heartbeat exception, forcing resubscribe:', e);
        try { currentChannel.unsubscribe(); } catch {}
        isSubscribed = false;
        retryAttempts = Math.min(retryAttempts + 1, maxRetries);
        channel = createChannel();
        setupChannelHandlers(channel);
        channel.subscribe(handleSubscribe);
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const startStaleChecker = () => {
    if (staleCheckTimer) {
      clearInterval(staleCheckTimer);
    }
    staleCheckTimer = setInterval(() => {
      const inactiveFor = Date.now() - connectionHealth.lastActivity;
      if (isSubscribed && inactiveFor > STALE_THRESHOLD_MS) {
        console.log(`⏳ No activity for ${inactiveFor}ms (>${STALE_THRESHOLD_MS}), resubscribing thread:${threadId}`);
        try { currentChannel?.unsubscribe(); } catch {}
        isSubscribed = false;
        retryAttempts = Math.min(retryAttempts + 1, maxRetries);
        channel = createChannel();
        setupChannelHandlers(channel);
        channel.subscribe(handleSubscribe);
      }
    }, Math.min(HEARTBEAT_INTERVAL_MS, 20000));
  };

  const handleSubscribe = async (status: string) => {
    console.log(`📡 Supabase subscription status for thread:${threadId}:`, status);
    
    if (status === 'SUBSCRIBED') {
      isSubscribed = true;
      retryAttempts = 0;
      connectionHealth.isHealthy = true;
      connectionHealth.lastActivity = Date.now();
      console.log(`✅ Successfully subscribed to thread:${threadId}`);
      
      // Start periodic heartbeat and stale checker
      startHeartbeat();
      startStaleChecker();
      
    } else if ((status === 'CLOSED' || status === 'TIMED_OUT') && shouldRetry && retryAttempts < maxRetries) {
      retryAttempts++;
      connectionHealth.reconnectAttempts++;
      console.log(`🔄 Channel closed, retrying... (${retryAttempts}/${maxRetries})`);
      
      // Progressive backoff with jitter: 2s, 4s, 8s, 16s, then 30s max
      const baseDelay = Math.min(retryDelayMs * Math.pow(2, retryAttempts - 1), 30000);
      const jitter = baseDelay * (0.2 * (Math.random() - 0.5)); // +/-10%
      const backoffDelay = Math.max(1000, baseDelay + jitter);
      
      reconnectTimer = setTimeout(async () => {
        if (shouldRetry) {
          console.log(`🔄 Attempting reconnection ${retryAttempts} for thread:${threadId}`);
          // Create fresh channel for reconnection
          channel = createChannel();
          setupChannelHandlers(channel);
          channel.subscribe(handleSubscribe);
        }
      }, backoffDelay);
      
    } else if (status === 'CHANNEL_ERROR' && retryAttempts < maxRetries) {
      retryAttempts++;
      connectionHealth.reconnectAttempts++;
      console.log(`❌ Channel error, retrying... (${retryAttempts}/${maxRetries})`);
      
      const baseDelay = Math.min(retryDelayMs * Math.pow(2, retryAttempts - 1), 30000);
      const jitter = baseDelay * (0.2 * (Math.random() - 0.5));
      const backoffDelay = Math.max(1000, baseDelay + jitter);
      
      reconnectTimer = setTimeout(async () => {
        if (shouldRetry) {
          // Create fresh channel for reconnection
          channel = createChannel();
          setupChannelHandlers(channel);
          channel.subscribe(handleSubscribe);
        }
      }, backoffDelay);
      
    } else if (retryAttempts >= maxRetries) {
      shouldRetry = false;
      connectionHealth.isHealthy = false;
      console.error(`💥 Max retries reached for thread:${threadId} subscription`);
      
      // Emit event for UI to show disconnected state
      window.dispatchEvent(new CustomEvent('supabaseConnectionError', {
        detail: { 
          threadId,
          error: 'Max retries exceeded',
          canRetry: true
        }
      }));
    }
  };

  const setupChannelHandlers = (ch: any) => {
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload: any) => {
        if (isSubscribed) {
          connectionHealth.lastActivity = Date.now();
          console.log(`📥 Received message via Supabase for thread:${threadId}`);
          onMessage(payload);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'threads',
        filter: `id=eq.${threadId}`,
      },
      (payload: any) => {
        if (isSubscribed) {
          connectionHealth.lastActivity = Date.now();
          try {
            onUpdate(payload);
          } catch (error) {
            console.warn(`Error handling thread update for ${threadId}:`, error);
          }
        }
      }
    )
    // Add heartbeat response handler
    .on('broadcast', { event: 'heartbeat' }, (payload: any) => {
      console.log(`💗 Heartbeat response received for thread:${threadId}`);
      connectionHealth.lastActivity = Date.now();
    });
  };
  
  setupChannelHandlers(channel);
  channel.subscribe(handleSubscribe);
  
  // Listen for global connection refresh events
  const handleConnectionRefresh = () => {
    const inactiveFor = Date.now() - connectionHealth.lastActivity;
    const isStale = inactiveFor > STALE_THRESHOLD_MS;
    if ((shouldRetry && !isSubscribed) || isStale) {
      console.log(`🔄 Global refresh triggered for thread:${threadId}${isStale ? ' (stale)' : ''}`);
      retryAttempts = 0; // Reset retry count
      try { currentChannel?.unsubscribe(); } catch {}
      channel = createChannel();
      setupChannelHandlers(channel);
      channel.subscribe(handleSubscribe);
    }
  };
  
  window.addEventListener('supabaseConnectionRefresh', handleConnectionRefresh);

  return () => {
    console.log(`🛑 Unsubscribing from thread:${threadId}`);
    shouldRetry = false;
    
    // Clear any pending reconnection timers
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (staleCheckTimer) {
      clearInterval(staleCheckTimer);
      staleCheckTimer = null;
    }
    
    // Remove global listener
    window.removeEventListener('supabaseConnectionRefresh', handleConnectionRefresh);
    
    // Unsubscribe from channel
    if (currentChannel) {
      try {
        currentChannel.unsubscribe();
      } catch (e) {
        console.warn('Error during unsubscribe:', e);
      }
    }
    
    // Remove from active subscriptions
    delete activeSubscriptions[channelKey];
  };
};

/**
 * Sets up real-time subscriptions for user's threads
 */
export const subscribeToUserThreads = (userId: string, onNewThread: (thread: any) => void) => {
  // Check if already subscribed
  const channelKey = `user_threads:${userId}`;
  if (activeSubscriptions[channelKey]) {
    console.log(`Already subscribed to ${channelKey}, skipping subscription`);
    // Return a dummy cleanup function
    return () => {
      console.log(`Unsubscribe called for already subscribed channel ${channelKey}`);
    };
  }
  
  // Mark as active
  activeSubscriptions[channelKey] = true;

  const channel = supabase
    .channel(`user_threads:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'threads',
        filter: `participant_ids=cs.{${userId}}`,
      },
      onNewThread
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
    // Remove from active subscriptions
    delete activeSubscriptions[channelKey];
  };
};
