// @ts-ignore
import Gun from 'gun';
// @ts-ignore
import 'gun/sea';

// Initialize Gun with more stable relay servers and connection settings
const gun = Gun({
  peers: [
    'https://gun-us.herokuapp.com/gun',
    'https://gun-eu.herokuapp.com/gun'
  ],
  localStorage: true,
  // Add connection stability settings
  retry: 1000,  // Retry connection after 1 second
  timeout: 5000, // 5 second timeout for operations
  // Reduce aggressive reconnection attempts
  axe: false
});

// Global Gun instance
export { gun };

// Initialize Gun SEA (Security, Encryption, Authorization)
export const SEA = Gun.SEA;

// Connection status tracking
export let isConnected = false;
export let connectedPeers = 0;

// Track connection status with better logging
(gun as any).on('hi', (peer: any) => {
  connectedPeers++;
  isConnected = true;
  console.log(`✅ Gun.js connected to peer:`, peer?.id || 'unknown', `(${connectedPeers} total peers)`);
});

(gun as any).on('bye', (peer: any) => {
  connectedPeers = Math.max(0, connectedPeers - 1);
  isConnected = connectedPeers > 0;
  console.log(`❌ Gun.js disconnected from peer:`, peer?.id || 'unknown', `(${connectedPeers} remaining peers)`);
});

// Add connection timeout and local fallback
setTimeout(() => {
  if (connectedPeers === 0) {
    console.warn('⚠️ Gun.js: No relay connections after 5s, enabling local-only mode');
    isConnected = true; // Allow local operation
  }
}, 5000);

// Helper to get connection status
export const getConnectionStatus = () => ({
  isConnected,
  connectedPeers,
  hasRelay: connectedPeers > 0
});

// Helper to wait for Gun to be ready
export const waitForGun = (timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isConnected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Gun connection timeout'));
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