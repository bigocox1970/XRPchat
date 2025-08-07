// Gun.js main export file - replaces Supabase functionality

// Core Gun.js exports
export { gun, SEA, getConnectionStatus, waitForGun } from './client';

// Authentication functions
export * from './auth';

// Chat and messaging functions  
export * from './chat';

// Real-time subscriptions
export * from './realtime';

// Contact management
export * from './contacts';

// Offline handling
export * from './offline';

// Hybrid migration support
export * from './hybrid';

// Export error handling utilities
export * from './errorHandling';

// Export testing utilities  
export * from './testing';

// Re-export types for compatibility
export type { GunUser, GunProfile } from './auth';
export type { GunMessage, GunThread } from './chat';
export type { GunContact } from './contacts';

// Initialize Gun.js when imported
import { initializeOfflineHandling } from './offline';
import { initializeHybridMode } from './hybrid';

// Auto-initialize with default settings
try {
  console.log('🚀 Initializing Gun.js services...');
  initializeOfflineHandling();
  initializeHybridMode();
  console.log('✅ Gun.js services initialized successfully');
} catch (error) {
  console.error('❌ Gun.js initialization failed:', error);
}