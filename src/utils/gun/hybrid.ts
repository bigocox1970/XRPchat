import { supabase } from '../supabase';
import * as supabaseChat from '../supabase/chat';
import * as supabaseAuth from '../supabase/auth';
import * as gunChat from './chat';
import * as gunAuth from './auth';
import * as gunContacts from './contacts';
import { getConnectionStatus } from './client';
import { GunMessage, GunThread } from './chat';

// Configuration for hybrid mode
interface HybridConfig {
  useGunForSending: boolean;
  useGunForReceiving: boolean;
  useGunForContacts: boolean;
  fallbackToSupabase: boolean;
  enableDualWrite: boolean; // Write to both systems
}

// Default hybrid configuration
let hybridConfig: HybridConfig = {
  useGunForSending: false,
  useGunForReceiving: false,
  useGunForContacts: false,
  fallbackToSupabase: true,
  enableDualWrite: true // Start with dual write for gradual migration
};

// Migration progress tracking
interface MigrationProgress {
  phase: 'dual-write' | 'gun-primary' | 'gun-only';
  supabaseEnabled: boolean;
  gunEnabled: boolean;
  lastMigrationStep: string;
  migratedUsers: string[];
}

let migrationProgress: MigrationProgress = {
  phase: 'dual-write',
  supabaseEnabled: true,
  gunEnabled: true,
  lastMigrationStep: 'initialization',
  migratedUsers: []
};

/**
 * Initialize hybrid mode with configuration
 */
export const initializeHybridMode = (config?: Partial<HybridConfig>) => {
  if (config) {
    hybridConfig = { ...hybridConfig, ...config };
  }
  
  console.log('Hybrid mode initialized:', hybridConfig);
  
  // Load migration progress from localStorage
  const stored = localStorage.getItem('gun_migration_progress');
  if (stored) {
    try {
      migrationProgress = { ...migrationProgress, ...JSON.parse(stored) };
    } catch (error) {
      console.warn('Error loading migration progress:', error);
    }
  }
};

/**
 * Update hybrid configuration
 */
export const updateHybridConfig = (updates: Partial<HybridConfig>) => {
  hybridConfig = { ...hybridConfig, ...updates };
  console.log('Hybrid config updated:', hybridConfig);
};

/**
 * Get current hybrid configuration
 */
export const getHybridConfig = (): HybridConfig => {
  return { ...hybridConfig };
};

/**
 * Hybrid message sending - writes to both systems during migration
 */
export const sendHybridMessage = async (
  threadId: string,
  senderId: string,
  senderPublicKey: string,
  recipientPublicKey: string,
  encryptedContent: string,
  type: 'text' | 'image' | 'file' = 'text'
) => {
  const errors: Error[] = [];
  let supabaseResult: any = null;
  let gunResult: GunMessage | null = null;

  // Try Supabase first if enabled
  if (hybridConfig.fallbackToSupabase || hybridConfig.enableDualWrite) {
    try {
      supabaseResult = await supabaseChat.sendMessage(threadId, senderId, encryptedContent, type);
      console.log('Message sent via Supabase:', supabaseResult.data?.id);
    } catch (error) {
      console.error('Supabase send failed:', error);
      errors.push(error as Error);
    }
  }

  // Try Gun.js if enabled or if Supabase failed
  if (hybridConfig.useGunForSending || (!supabaseResult && errors.length > 0)) {
    try {
      const connectionStatus = getConnectionStatus();
      if (connectionStatus.isConnected || connectionStatus.connectedPeers > 0) {
        gunResult = await gunChat.sendGunMessage(
          threadId,
          senderId,
          senderPublicKey,
          recipientPublicKey,
          encryptedContent,
          type
        );
        console.log('Message sent via Gun.js:', gunResult.id);
      } else {
        throw new Error('Gun.js not connected');
      }
    } catch (error) {
      console.error('Gun.js send failed:', error);
      errors.push(error as Error);
    }
  }

  // Return result or throw if both failed
  if (supabaseResult || gunResult) {
    return {
      supabase: supabaseResult,
      gun: gunResult,
      method: supabaseResult ? 'supabase' : 'gun'
    };
  } else {
    throw new Error(`Message sending failed: ${errors.map(e => e.message).join(', ')}`);
  }
};

/**
 * Hybrid thread creation - creates in both systems during migration
 */
export const createHybridThread = async (
  name: string,
  participantIds: string[],
  createdBy: string
) => {
  const errors: Error[] = [];
  let supabaseResult: any = null;
  let gunResult: GunThread | null = null;

  // Try Supabase first
  if (hybridConfig.fallbackToSupabase || hybridConfig.enableDualWrite) {
    try {
      supabaseResult = await supabaseChat.createThread(name, participantIds, createdBy);
      console.log('Thread created via Supabase:', supabaseResult.id);
    } catch (error) {
      console.error('Supabase thread creation failed:', error);
      errors.push(error as Error);
    }
  }

  // Try Gun.js
  if (hybridConfig.useGunForSending || (!supabaseResult && errors.length > 0)) {
    try {
      gunResult = await gunChat.createGunThread(name, participantIds, createdBy);
      console.log('Thread created via Gun.js:', gunResult.id);
    } catch (error) {
      console.error('Gun.js thread creation failed:', error);
      errors.push(error as Error);
    }
  }

  if (supabaseResult || gunResult) {
    return {
      supabase: supabaseResult,
      gun: gunResult,
      method: supabaseResult ? 'supabase' : 'gun'
    };
  } else {
    throw new Error(`Thread creation failed: ${errors.map(e => e.message).join(', ')}`);
  }
};

/**
 * Hybrid contact management - manages contacts in both systems
 */
export const addHybridContact = async (
  contactAddress: string,
  contactPublicKey: string,
  contactUsername?: string
) => {
  const errors: Error[] = [];
  let supabaseResult: any = null;
  let gunResult: any = null;

  // Add to Supabase
  if (hybridConfig.fallbackToSupabase || hybridConfig.enableDualWrite) {
    try {
      supabaseResult = await supabaseAuth.addContact(contactAddress);
      console.log('Contact added via Supabase');
    } catch (error) {
      console.error('Supabase contact add failed:', error);
      errors.push(error as Error);
    }
  }

  // Add to Gun.js
  if (hybridConfig.useGunForContacts || (!supabaseResult && errors.length > 0)) {
    try {
      gunResult = await gunContacts.addGunContact(contactAddress, contactPublicKey, contactUsername);
      console.log('Contact added via Gun.js');
    } catch (error) {
      console.error('Gun.js contact add failed:', error);
      errors.push(error as Error);
    }
  }

  if (supabaseResult || gunResult) {
    return {
      supabase: supabaseResult,
      gun: gunResult,
      method: supabaseResult ? 'supabase' : 'gun'
    };
  } else {
    throw new Error(`Contact add failed: ${errors.map(e => e.message).join(', ')}`);
  }
};

/**
 * Migrate user to Gun.js phase by phase
 */
export const migrateUserToGun = async (userId: string, phase: 'contacts' | 'messaging' | 'complete') => {
  try {
    console.log(`Starting migration phase '${phase}' for user:`, userId);

    switch (phase) {
      case 'contacts':
        // Migrate contacts from Supabase to Gun.js
        await migrateUserContacts(userId);
        break;

      case 'messaging':
        // Enable Gun.js messaging for this user
        hybridConfig.useGunForSending = true;
        hybridConfig.useGunForReceiving = true;
        break;

      case 'complete':
        // Complete migration - disable Supabase for this user
        hybridConfig.useGunForSending = true;
        hybridConfig.useGunForReceiving = true;
        hybridConfig.useGunForContacts = true;
        hybridConfig.fallbackToSupabase = false;
        break;
    }

    // Update migration progress
    migrationProgress.migratedUsers.push(userId);
    migrationProgress.lastMigrationStep = phase;
    localStorage.setItem('gun_migration_progress', JSON.stringify(migrationProgress));

    console.log(`Migration phase '${phase}' completed for user:`, userId);
  } catch (error) {
    console.error(`Migration phase '${phase}' failed for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Migrate user's contacts from Supabase to Gun.js
 */
const migrateUserContacts = async (userId: string) => {
  try {
    // Get contacts from Supabase
    const supabaseContacts = await supabaseAuth.getContacts();
    
    console.log(`Migrating ${supabaseContacts.length} contacts to Gun.js`);

    // Add each contact to Gun.js
    for (const contact of supabaseContacts) {
      try {
        await gunContacts.addGunContact(
          (contact as any).friend_address,
          (contact as any).friend_public_key,
          (contact as any).friend_username || 'Unknown'
        );
        console.log('Migrated contact:', (contact as any).friend_address);
      } catch (error) {
        console.warn('Failed to migrate contact:', (contact as any).friend_address, error);
      }
    }

    console.log('Contact migration completed');
  } catch (error) {
    console.error('Contact migration failed:', error);
    throw error;
  }
};

/**
 * Rollback migration - switch back to Supabase
 */
export const rollbackToSupabase = (userId: string) => {
  console.log('Rolling back to Supabase for user:', userId);
  
  // Reset to Supabase-only configuration
  hybridConfig = {
    useGunForSending: false,
    useGunForReceiving: false,
    useGunForContacts: false,
    fallbackToSupabase: true,
    enableDualWrite: false
  };

  // Remove user from migrated list
  migrationProgress.migratedUsers = migrationProgress.migratedUsers.filter(id => id !== userId);
  migrationProgress.lastMigrationStep = 'rollback';
  localStorage.setItem('gun_migration_progress', JSON.stringify(migrationProgress));

  console.log('Rollback completed');
};

/**
 * Get migration status
 */
export const getMigrationStatus = () => {
  const connectionStatus = getConnectionStatus();
  
  return {
    ...migrationProgress,
    hybridConfig,
    gunConnection: connectionStatus,
    supabaseConnection: supabase ? 'connected' : 'disconnected'
  };
};

/**
 * Test both systems and recommend migration step
 */
export const testSystemsAndRecommend = async () => {
  const results = {
    supabase: { available: false, latency: 0, error: null as Error | null },
    gun: { available: false, latency: 0, error: null as Error | null },
    recommendation: 'stay-supabase' as 'migrate-to-gun' | 'stay-supabase' | 'hybrid-mode'
  };

  // Test Supabase
  const supabaseStart = Date.now();
  try {
    await supabase.from('profiles').select('id').limit(1);
    results.supabase.available = true;
    results.supabase.latency = Date.now() - supabaseStart;
  } catch (error) {
    results.supabase.error = error as Error;
  }

  // Test Gun.js
  const gunStart = Date.now();
  try {
    const connectionStatus = getConnectionStatus();
    results.gun.available = connectionStatus.isConnected;
    results.gun.latency = Date.now() - gunStart;
  } catch (error) {
    results.gun.error = error as Error;
  }

  // Make recommendation
  if (results.gun.available && results.gun.latency < results.supabase.latency) {
    results.recommendation = 'migrate-to-gun';
  } else if (results.gun.available && results.supabase.available) {
    results.recommendation = 'hybrid-mode';
  } else {
    results.recommendation = 'stay-supabase';
  }

  return results;
};