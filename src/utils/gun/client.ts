// @ts-ignore
import Gun from 'gun';
// @ts-ignore
import 'gun/sea';

// Initialize Gun in localStorage-only mode to avoid WebSocket issues
const gun = Gun({
  peers: [], // No remote peers - localStorage only
  localStorage: true,
  // Disable all network features to prevent WebSocket errors
  axe: false
});

// Global Gun instance
export { gun };

// Initialize Gun SEA (Security, Encryption, Authorization)
export const SEA = Gun.SEA;

// Connection status tracking
export let isConnected = false;
export let connectedPeers = 0;

// Set as connected since we're in localStorage-only mode
isConnected = true;
connectedPeers = 0;
console.log('✅ Gun.js initialized in localStorage-only mode (no P2P networking)');

// Helper to get connection status
export const getConnectionStatus = () => ({
  isConnected,
  connectedPeers,
  hasRelay: connectedPeers > 0
});

// Helper to wait for Gun to be ready (always ready in localStorage mode)
export const waitForGun = (timeout = 5000): Promise<void> => {
  return Promise.resolve(); // Always resolve immediately in localStorage-only mode
};