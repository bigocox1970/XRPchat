// @ts-ignore
import Gun from 'gun';
// @ts-ignore
import 'gun/sea';

// Initialize Gun with more reliable relay servers for P2P messaging
const gun = Gun({
  peers: [
    'https://gunjs.herokuapp.com/gun', // More stable relay
    'wss://gundb.herokuapp.com/gun',   // WebSocket relay
  ],
  localStorage: true,
  // Connection stability settings
  retry: 2000,
  timeout: 8000,
  // Allow graceful fallback
  axe: false
});

// Global Gun instance
export { gun };

// Initialize Gun SEA (Security, Encryption, Authorization)
export const SEA = Gun.SEA;

// Connection status tracking
export let isConnected = false;
export let connectedPeers = 0;

// Track connection status with better error handling
(gun as any).on('hi', (peer: any) => {
  connectedPeers++;
  isConnected = true;
  console.log(`✅ Gun.js connected to peer:`, peer?.url || peer?.id || 'unknown', `(${connectedPeers} total peers)`);
});

(gun as any).on('bye', (peer: any) => {
  connectedPeers = Math.max(0, connectedPeers - 1);
  isConnected = connectedPeers > 0;
  console.log(`❌ Gun.js disconnected from peer:`, peer?.url || peer?.id || 'unknown', `(${connectedPeers} remaining peers)`);
});

// Graceful fallback to localStorage after connection attempts
setTimeout(() => {
  if (connectedPeers === 0) {
    console.warn('⚠️ Gun.js: No relay connections after 10s, continuing with localStorage (offline mode)');
    isConnected = true; // Allow local operation as fallback
  } else {
    console.log(`🌐 Gun.js: Connected to ${connectedPeers} peers for P2P messaging`);
  }
}, 10000);

// Helper to get connection status
export const getConnectionStatus = () => ({
  isConnected,
  connectedPeers,
  hasRelay: connectedPeers > 0
});

// Helper to wait for Gun to be ready with P2P connection attempts
export const waitForGun = (timeout = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isConnected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      // Don't reject - allow fallback to localStorage mode
      console.warn('Gun.js: Connection timeout, proceeding with localStorage fallback');
      isConnected = true;
      resolve();
    }, timeout);

    const checkConnection = () => {
      if (isConnected) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(checkConnection, 100);
      }
    };
    
    checkConnection();
  });
};