// @ts-ignore
import Gun from 'gun';
// @ts-ignore
import 'gun/sea';
// Enable AXE transport optimisations
// @ts-ignore
import 'gun/axe';

// Initialize Gun with current working relay servers for P2P messaging
const relayEnv = (import.meta as any).env?.VITE_GUN_RELAY as string | undefined;
const envPeers = relayEnv ? relayEnv.split(',').map((p: string) => p.trim()).filter(Boolean) : [];

const gun = Gun({
  peers: envPeers.length ? envPeers : [],
  localStorage: true,
  // Reduced connection attempts to prevent spam
  retry: 5000,        // Longer retry delay
  timeout: 10000,     // Shorter timeout to fail faster
  // Allow graceful fallback but track real connections
  axe: true,
  // Optimized batch settings
  batch: 20,          // Smaller batches for better reliability
  chunk: 1024 * 4,    // Smaller chunks
  // Disable WebRTC to reduce connection complexity
  rtc: false
});

// Global Gun instance
export { gun };

// Initialize Gun SEA (Security, Encryption, Authorization)
export const SEA = Gun.SEA;

// Enhanced connection status tracking
export let isConnected = false;
export let connectedPeers = 0;
export let hasRealPeers = false; // Track if we have actual relay connections
const peerConnections = new Set<string>();

// Enhanced connection tracking with peer identification
(gun as any).on('hi', (peer: any) => {
  const peerId = peer?.url || peer?.id || `unknown-${Date.now()}`;
  
  // Only count if not already connected to this peer
  if (!peerConnections.has(peerId)) {
    peerConnections.add(peerId);
    connectedPeers++;
    
    // Check if this is a real relay server (not just localStorage)
    const isRealPeer = peer?.url && (peer.url.includes('http') || peer.url.includes('ws'));
    if (isRealPeer) {
      hasRealPeers = true;
    }
    
    console.log(`✅ Gun.js connected to ${isRealPeer ? 'relay' : 'local'} peer:`, peerId, `(${connectedPeers} total peers, ${hasRealPeers ? 'has relay' : 'local only'})`);
  }
  
  isConnected = true;
  
  // Emit custom event for React components
  window.dispatchEvent(new CustomEvent('gunConnectionChange', { 
    detail: { connected: true, peers: connectedPeers, hasRealPeers } 
  }));
});

(gun as any).on('bye', (peer: any) => {
  const peerId = peer?.url || peer?.id || `unknown-${Date.now()}`;
  
  // Only decrement if we were actually connected to this peer
  if (peerConnections.has(peerId)) {
    peerConnections.delete(peerId);
    connectedPeers = Math.max(0, connectedPeers - 1);
    
    // Recheck if we still have real relay peers
    hasRealPeers = Array.from(peerConnections).some(id => 
      id.includes('http') || id.includes('ws') || id.includes('relay')
    );
    
    console.log(`❌ Gun.js disconnected from peer:`, peerId, `(${connectedPeers} remaining peers, ${hasRealPeers ? 'has relay' : 'local only'})`);
  }
  
  isConnected = connectedPeers > 0;
  
  // Emit custom event for React components
  window.dispatchEvent(new CustomEvent('gunConnectionChange', { 
    detail: { connected: isConnected, peers: connectedPeers, hasRealPeers } 
  }));
});

// Add connection diagnostics
(gun as any).on('out', (msg: any) => {
  if (msg?.put?.['#']) {
    console.log(`📤 Gun.js outbound data:`, Object.keys(msg.put).length, 'items');
  }
});

// Log any errors
(gun as any).on('in', (msg: any) => {
  if (msg?.err) {
    console.warn('⚠️ Gun.js error:', msg.err);
  }
});

// Enhanced connection test with relay verification
setTimeout(() => {
  console.log('🔄 Testing Gun.js connection and relay availability...');
  const testKey = `connection_test_${Date.now()}`;
  const testData = { test: true, timestamp: Date.now(), source: 'local' };
  
  // Write test data
  gun.get('connection_test').get(testKey).put(testData);
  
  // Try to read it back to verify connection
  setTimeout(() => {
    gun.get('connection_test').get(testKey).once((data: any) => {
      if (data && data.test) {
        console.log('✅ Gun.js localStorage connection test successful');
        
        // Set as connected for localStorage mode, but distinguish from real P2P
        if (connectedPeers === 0) {
          isConnected = true;
          hasRealPeers = false;
          console.log('🌐 Gun.js: LocalStorage mode active (no relay peers)');
          
          // Emit event to update UI
          window.dispatchEvent(new CustomEvent('gunConnectionChange', { 
            detail: { connected: true, peers: 0, hasRealPeers: false } 
          }));
        }
      } else {
        console.warn('⚠️ Gun.js connection test failed');
      }
      
      // Clean up test data
      setTimeout(() => {
        gun.get('connection_test').get(testKey).put(null);
      }, 5000);
    });
  }, 2000); // Increased wait time for better reliability
}, 3000); // Delayed start to allow peer connections

// Enhanced relay connection monitoring
setTimeout(() => {
  if (connectedPeers === 0 || !hasRealPeers) {
    console.warn(`⚠️ Gun.js: No relay connections after 20s (${connectedPeers} total peers), continuing with localStorage fallback`);
    
    if (connectedPeers === 0) {
      isConnected = true; // Allow local operation as fallback
    }
    hasRealPeers = false;
    
    // Try to force new relay connections
    attemptRelayReconnection();
    
    // Emit event to update UI
    window.dispatchEvent(new CustomEvent('gunConnectionChange', { 
      detail: { connected: isConnected, peers: connectedPeers, hasRealPeers: false } 
    }));
  } else {
    console.log(`🌐 Gun.js: Connected to ${connectedPeers} peers (${hasRealPeers ? 'including relays' : 'local only'}) for P2P messaging`);
  }
}, 20000); // Increased timeout for better relay connection attempts

// Function to attempt reconnection to relay servers
const attemptRelayReconnection = () => {
  console.log('🔄 Attempting to reconnect to Gun.js relay servers...');
  
  // Only use environment peers - no hardcoded fallbacks
  const relayPeers = envPeers;
  
  relayPeers.forEach((peerUrl: string, index: number) => {
    setTimeout(() => {
      try {
        console.log(`🔄 Attempting connection to ${peerUrl}`);
        
        // Try to connect by sending test data to this specific peer
        const testData = {
          connectionTest: true,
          timestamp: Date.now(),
          targetPeer: peerUrl
        };
        
        gun.get('relay_test').get(`test_${index}_${Date.now()}`).put(testData);
        
      } catch (error) {
        console.warn(`❌ Failed to connect to ${peerUrl}:`, error);
      }
    }, index * 2000); // Stagger connection attempts
  });
};

// Enhanced helper to get connection status
export const getConnectionStatus = () => ({
  isConnected,
  connectedPeers,
  hasRelay: hasRealPeers,
  hasRealPeers,
  isLocalOnly: isConnected && !hasRealPeers,
  peerList: Array.from(peerConnections)
});

// Enhanced helper to wait for Gun to be ready with better fallback
export const waitForGun = (timeout = 15000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isConnected) {
      resolve();
      return;
    }

    // Try to force a connection attempt
    attemptReconnection();

    const timer = setTimeout(() => {
      // Don't reject - always allow fallback to localStorage mode
      console.warn('Gun.js: Connection timeout, proceeding with localStorage fallback');
      isConnected = true;
      resolve();
    }, timeout);

    const checkConnection = () => {
      if (isConnected || connectedPeers > 0) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(checkConnection, 500); // Check every 500ms instead of 100ms
      }
    };
    
    checkConnection();
  });
};

// Export reconnection function for external use
export const forceReconnection = () => {
  console.log('🔄 Force reconnection requested');
  attemptReconnection();
};

// Enhanced function to get detailed connection health
export const getConnectionHealth = () => {
  return {
    isConnected,
    connectedPeers,
    hasRelay: hasRealPeers,
    hasRealPeers,
    isLocalOnly: isConnected && !hasRealPeers,
    connectionLossTime,
    timeSinceLoss: connectionLossTime ? Date.now() - connectionLossTime : 0,
    autoReconnectionActive: autoReconnectInterval !== null,
    peerList: Array.from(peerConnections),
    connectionType: hasRealPeers ? 'P2P + Relay' : isConnected ? 'Local Only' : 'Disconnected'
  };
};

// Export the relay reconnection function
export const reconnectToRelays = attemptRelayReconnection;

// Connection keepalive mechanism to prevent timeouts
let keepaliveInterval: NodeJS.Timeout | null = null;
let keepaliveFailureCount = 0;
const maxKeepaliveFailures = 3;

// Enhanced keepalive heartbeat to maintain P2P connections
export const startKeepalive = () => {
  if (keepaliveInterval) return;
  
  console.log('🫀 Starting Gun.js connection keepalive...');
  
  keepaliveInterval = setInterval(() => {
    if (connectedPeers > 0) {
      // Send a small heartbeat message to maintain connection
      const heartbeat = {
        type: 'heartbeat',
        timestamp: Date.now(),
        id: `heartbeat_${Date.now()}`,
        keepaliveSequence: Date.now()
      };
      
      try {
        const pulseKey = `pulse_${Date.now()}`;
        gun.get('heartbeat').get(pulseKey).put(heartbeat);
        console.log('💗 Sent P2P keepalive pulse');
        
        // Reset failure count on successful pulse
        keepaliveFailureCount = 0;
        
        // Clean up old heartbeats
        setTimeout(() => {
          gun.get('heartbeat').get(pulseKey).put(null);
        }, 60000); // Keep for 1 minute instead of 30 seconds
        
      } catch (error) {
        console.warn('⚠️ Keepalive pulse failed:', error);
        keepaliveFailureCount++;
        
        // If too many keepalive failures, attempt reconnection
        if (keepaliveFailureCount >= maxKeepaliveFailures) {
          console.log('💥 Too many keepalive failures, attempting reconnection');
          keepaliveFailureCount = 0;
          attemptReconnection();
        }
      }
    } else {
      console.log('💔 No peers connected for keepalive');
      // Try to reconnect if no peers (including relay reconnection)
      attemptReconnection();
      if (!hasRealPeers) {
        attemptRelayReconnection();
      }
    }
  }, 20000); // Send keepalive every 20 seconds instead of 30
};

// Stop keepalive mechanism
export const stopKeepalive = () => {
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
    keepaliveFailureCount = 0;
    console.log('🛑 Stopped Gun.js keepalive');
  }
};

// Auto-start keepalive after connection with enhanced logic
setTimeout(() => {
  if (connectedPeers > 0) {
    startKeepalive();
  } else {
    // If no peers after initial timeout, try reconnection
    console.log('🔄 No peers after initial timeout, attempting reconnection');
    attemptReconnection();
  }
}, 5000);

// Restart keepalive when connections are established
(gun as any).on('hi', () => {
  // Clear connection loss time when peer connects
  connectionLossTime = null;
  
  if (!keepaliveInterval) {
    setTimeout(startKeepalive, 1000);
  }
});

// Stop keepalive when all connections lost, but start auto-reconnection
(gun as any).on('bye', () => {
  if (connectedPeers === 0) {
    stopKeepalive();
    // Mark connection loss time for auto-reconnection
    if (!connectionLossTime) {
      connectionLossTime = Date.now();
    }
  }
});

// Enhanced connection monitoring and auto-reconnection
let autoReconnectInterval: NodeJS.Timeout | null = null;
let connectionLossTime: number | null = null;

// Function to attempt reconnection
const attemptReconnection = () => {
  console.log('🔄 Attempting Gun.js reconnection...');
  
  // Reset connection state
  connectedPeers = 0;
  isConnected = false;
  
  // Try to reconnect by creating a new Gun instance with same peers
  try {
    // Send test pulse to trigger connection attempt
    const testPulse = {
      type: 'reconnect_test',
      timestamp: Date.now(),
      id: `reconnect_${Date.now()}`
    };
    gun.get('reconnect_test').get(`test_${Date.now()}`).put(testPulse);
    
    // Clean up test data after 10 seconds
    setTimeout(() => {
      gun.get('reconnect_test').get(`test_${Date.now()}`).put(null);
    }, 10000);
    
  } catch (error) {
    console.warn('⚠️ Reconnection test failed:', error);
  }
};

// Start auto-reconnection monitoring
const startAutoReconnection = () => {
  if (autoReconnectInterval) return;
  
  console.log('🔄 Starting Gun.js auto-reconnection monitoring');
  
  autoReconnectInterval = setInterval(() => {
    if (connectedPeers === 0) {
      if (!connectionLossTime) {
        connectionLossTime = Date.now();
        console.log('⚠️ Gun.js connection loss detected');
      } else {
        const timeSinceLoss = Date.now() - connectionLossTime;
        
        // Try to reconnect every 30 seconds when disconnected
        if (timeSinceLoss > 30000) {
          attemptReconnection();
          connectionLossTime = Date.now(); // Reset timer
        }
      }
    } else {
      // Reset connection loss timer when connected
      if (connectionLossTime) {
        console.log('✅ Gun.js connection restored');
        connectionLossTime = null;
      }
    }
  }, 10000); // Check every 10 seconds
};

// Start auto-reconnection monitoring after initial setup
setTimeout(startAutoReconnection, 5000);

// Handle page visibility changes to maintain connections in PWA
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('📱 App became visible, checking P2P connections...');
      
      // Force reconnection attempt when app becomes visible
      if (connectedPeers === 0) {
        console.log('🔄 No peers detected, forcing reconnection attempt');
        attemptReconnection();
      }
      
      // Restart keepalive if we have peers
      if (connectedPeers > 0 && !keepaliveInterval) {
        startKeepalive();
      }
      
      // Send immediate pulse to verify connection
      if (connectedPeers > 0) {
        try {
          const reconnectPulse = {
            type: 'reconnect',
            timestamp: Date.now(),
            id: `reconnect_${Date.now()}`
          };
          gun.get('heartbeat').get(`reconnect_${Date.now()}`).put(reconnectPulse);
          console.log('📡 Sent reconnection pulse');
        } catch (error) {
          console.warn('⚠️ Reconnection pulse failed:', error);
        }
      }
    } else {
      console.log('📱 App became hidden, maintaining background P2P connections...');
      // Keep connections alive even when hidden (important for PWA)
    }
  });

  // Handle beforeunload to gracefully close connections
  window.addEventListener('beforeunload', () => {
    console.log('🔄 App closing, cleaning up P2P connections...');
    stopKeepalive();
  });

  // Handle focus/blur events for additional connection management
  window.addEventListener('focus', () => {
    console.log('👀 Window gained focus, verifying P2P connections...');
    
    // Always attempt reconnection on focus if no peers
    if (connectedPeers === 0) {
      console.log('🔄 Window focused with no peers, attempting reconnection');
      attemptReconnection();
    } else {
      // Send verification pulse if we have peers
      try {
        const focusPulse = {
          type: 'focus',
          timestamp: Date.now(),
          id: `focus_${Date.now()}`
        };
        gun.get('heartbeat').get(`focus_${Date.now()}`).put(focusPulse);
      } catch (error) {
        console.warn('⚠️ Focus pulse failed:', error);
      }
    }
  });
  
  // Handle online/offline events
  window.addEventListener('online', () => {
    console.log('🌐 Network came online, attempting Gun.js reconnection');
    attemptReconnection();
    
    // Restart auto-reconnection monitoring
    if (!autoReconnectInterval) {
      startAutoReconnection();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('📵 Network went offline, Gun.js will attempt reconnection when online');
  });

  // Add unload cleanup
  window.addEventListener('beforeunload', () => {
    if (autoReconnectInterval) {
      clearInterval(autoReconnectInterval);
      autoReconnectInterval = null;
    }
  });
}