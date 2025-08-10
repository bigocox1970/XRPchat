import { gun } from './client';
import { getCurrentGunUser } from './auth';

export interface GunContact {
  id: string;
  address: string;
  username: string;
  avatar_url?: string;
  avatar_seed?: string;
  public_key: string;
  added_at: string;
  last_active?: string;
  is_online?: boolean;
}

/**
 * Add a new contact by their XRP address and public key
 */
export const addGunContact = async (
  contactAddress: string,
  contactPublicKey: string,
  contactUsername?: string,
  avatarUrl?: string,
  avatarSeed?: string
): Promise<GunContact> => {
  try {
    const currentUser = getCurrentGunUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const now = new Date().toISOString();
    const contact: GunContact = {
      id: contactAddress,
      address: contactAddress,
      username: contactUsername || 'Unknown User',
      avatar_url: avatarUrl,
      avatar_seed: avatarSeed,
      public_key: contactPublicKey,
      added_at: now,
      last_active: now,
      is_online: false
    };

    // Store contact in user's contact list
    currentUser.get('contacts').get(contactAddress).put(contact);

    // Also store in global contacts for easier discovery
    gun.get('contacts').get(contactAddress).put({
      address: contactAddress,
      username: contact.username,
      public_key: contactPublicKey,
      avatar_url: avatarUrl,
      avatar_seed: avatarSeed,
      last_updated: now
    });

    console.log('Contact added successfully:', contactAddress);
    return contact;
  } catch (error) {
    console.error('Error adding Gun contact:', error);
    throw error;
  }
};

/**
 * Get all contacts for current user
 */
export const getGunContacts = async (): Promise<GunContact[]> => {
  const currentUser = getCurrentGunUser();
  if (!currentUser) {
    return [];
  }

  return new Promise((resolve) => {
    const contacts: GunContact[] = [];
    const contactIds = new Set<string>();

    currentUser.get('contacts').map().once((contact: GunContact, key: string) => {
      if (contact && contact.address && !contactIds.has(contact.address)) {
        contactIds.add(contact.address);
        contacts.push({ ...contact, id: key });
      }
    });

    // Give Gun time to load all contacts
    setTimeout(() => {
      resolve(contacts.sort((a, b) => a.username.localeCompare(b.username)));
    }, 1000);
  });
};

/**
 * Update contact information
 */
export const updateGunContact = async (
  contactAddress: string,
  updates: Partial<GunContact>
): Promise<void> => {
  try {
    const currentUser = getCurrentGunUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    // Get existing contact
    const existingContact = await new Promise<GunContact | null>((resolve) => {
      currentUser.get('contacts').get(contactAddress).once((contact: GunContact) => {
        resolve(contact || null);
      });
    });

    if (!existingContact) {
      throw new Error('Contact not found');
    }

    // Update contact with new information
    const updatedContact = {
      ...existingContact,
      ...updates,
      last_active: new Date().toISOString()
    };

    currentUser.get('contacts').get(contactAddress).put(updatedContact);

    // Also update global contacts
    gun.get('contacts').get(contactAddress).put({
      address: contactAddress,
      username: updatedContact.username,
      public_key: updatedContact.public_key,
      avatar_url: updatedContact.avatar_url,
      avatar_seed: updatedContact.avatar_seed,
      last_updated: new Date().toISOString()
    });

    console.log('Contact updated successfully:', contactAddress);
  } catch (error) {
    console.error('Error updating Gun contact:', error);
    throw error;
  }
};

/**
 * Remove a contact
 */
export const removeGunContact = async (contactAddress: string): Promise<void> => {
  try {
    const currentUser = getCurrentGunUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    // Remove contact from user's contact list
    currentUser.get('contacts').get(contactAddress).put(null);

    console.log('Contact removed successfully:', contactAddress);
  } catch (error) {
    console.error('Error removing Gun contact:', error);
    throw error;
  }
};

/**
 * Find contact by address
 */
export const findGunContactByAddress = async (address: string): Promise<GunContact | null> => {
  const currentUser = getCurrentGunUser();
  if (!currentUser) {
    return null;
  }

  return new Promise((resolve) => {
    currentUser.get('contacts').get(address).once((contact: GunContact) => {
      resolve(contact || null);
    });
  });
};

/**
 * Search contacts by username or address
 */
export const searchGunContacts = async (query: string): Promise<GunContact[]> => {
  const contacts = await getGunContacts();
  const lowercaseQuery = query.toLowerCase();

  return contacts.filter(contact => 
    contact.username.toLowerCase().includes(lowercaseQuery) ||
    contact.address.toLowerCase().includes(lowercaseQuery)
  );
};

/**
 * Get contact by public key
 */
export const findGunContactByPublicKey = async (publicKey: string): Promise<GunContact | null> => {
  const contacts = await getGunContacts();
  return contacts.find(contact => contact.public_key === publicKey) || null;
};

/**
 * Check if user is a contact
 */
export const isGunContact = async (address: string): Promise<boolean> => {
  const contact = await findGunContactByAddress(address);
  return contact !== null;
};

/**
 * Get contact's online status
 */
export const getGunContactOnlineStatus = async (address: string): Promise<{ isOnline: boolean; lastSeen: string | null }> => {
  return new Promise((resolve) => {
    gun.get('presence').get(address).once((presence: any) => {
      resolve({
        isOnline: presence?.isOnline || false,
        lastSeen: presence?.lastSeen || null
      });
    });
  });
};

/**
 * Update contact's last active time
 */
export const updateGunContactLastActive = async (contactAddress: string): Promise<void> => {
  try {
    const currentUser = getCurrentGunUser();
    if (!currentUser) {
      return;
    }

    const now = new Date().toISOString();
    
    // Update in user's contact list
    currentUser.get('contacts').get(contactAddress).get('last_active').put(now);
    
    // Update in global contacts
    gun.get('contacts').get(contactAddress).get('last_updated').put(now);
  } catch (error) {
    console.error('Error updating contact last active:', error);
  }
};

/**
 * Sync contacts from QR code scan data
 * This function helps maintain compatibility with the existing QR code system
 */
export const syncContactFromQRData = async (qrData: {
  address: string;
  publicKey: string;
  username?: string;
  avatar_url?: string;
  avatar_seed?: string;
}): Promise<GunContact> => {
  try {
    // Check if contact already exists
    const existingContact = await findGunContactByAddress(qrData.address);
    
    if (existingContact) {
      // Update existing contact with new information
      await updateGunContact(qrData.address, {
        username: qrData.username || existingContact.username,
        public_key: qrData.publicKey,
        avatar_url: qrData.avatar_url || existingContact.avatar_url,
        avatar_seed: qrData.avatar_seed || existingContact.avatar_seed
      });
      
      return { ...existingContact, public_key: qrData.publicKey };
    } else {
      // Add new contact
      return await addGunContact(
        qrData.address,
        qrData.publicKey,
        qrData.username,
        qrData.avatar_url,
        qrData.avatar_seed
      );
    }
  } catch (error) {
    console.error('Error syncing contact from QR data:', error);
    throw error;
  }
};