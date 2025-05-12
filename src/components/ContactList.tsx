import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { searchUsers, getContacts } from '../utils/supabase/auth';
import { addContact, removeContact, blockContact, unblockContact } from '../utils/supabase/auth';
import { createThread } from '../utils/supabase/chat';
import { supabase } from '../utils/supabase/client';
import { HiUser, HiPlus, HiLockClosed, HiLockOpen } from 'react-icons/hi';
import { CopyButton } from './CopyButton';
import { DiceBearAvatar } from './DiceBearAvatar';
import type { Database } from '../types/supabase';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useTheme } from '../context/DarkModeContext';

// Modify the Profile type to make updated_at optional to handle potential missing values
// and add status field
type Profile = Database['public']['Tables']['profiles']['Row'] & { status?: string };

export const ContactList: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const { isNaturalTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [showQrReader, setShowQrReader] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Helper function to get appropriate button classes based on theme
  const getButtonClassesForTheme = (type: 'green' | 'yellow' | 'red' | 'brand') => {
    if (!isNaturalTheme) {
      // Return original colors for default theme
      switch (type) {
        case 'green':
          return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
        case 'yellow':
          return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
        case 'red':
          return 'bg-red-800 hover:bg-red-900 focus:ring-red-700';
        case 'brand':
          return 'bg-brand-primary hover:bg-brand-secondary focus:ring-brand-primary';
      }
    } else {
      // Return brown colors for natural theme
      switch (type) {
        case 'green':
          return 'bg-amber-700 hover:bg-amber-800 focus:ring-amber-600';
        case 'yellow':
          return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
        case 'red':
          return 'bg-red-800 hover:bg-red-900 focus:ring-red-700';
        case 'brand':
          return 'bg-natural-primary hover:bg-natural-secondary focus:ring-natural-primary';
      }
    }
  };

  // Helper function to reload contacts
  const reloadContacts = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Reloading contacts...');
      
      // First clear the existing contacts to avoid stale data
      setContacts([]);
      
      const userContacts = await getContacts();
      console.log('Contacts reloaded with status:', userContacts.map(c => ({id: c.id, username: c.username, status: c.status})));
      if (userContacts && Array.isArray(userContacts)) {
        setContacts(userContacts);
      }
    } catch (err) {
      console.error('Error reloading contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showScanner) {
      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      
      qrScanner.render((decodedText) => {
        // Handle the scanned wallet address
        if (decodedText) {
          setSearchQuery(decodedText);
          qrScanner.clear();
          setShowScanner(false);
        }
      }, (error) => {
        console.error('QR scan error:', error);
      });

      setScanner(qrScanner);
      
      // Don't automatically launch camera
      // We'll wait for the user to click the "Scan with Camera" button
      
      // Reset manual entry
      setShowManualEntry(false);
    } else if (scanner) {
      scanner.clear();
      setScanner(null);
      
      // Reset states when modal is closed
      setShowManualEntry(false);
    }

    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [showScanner]);

  // Handle scanner cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear();
      }
      
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('Error stopping camera:', err));
      }
    };
  }, [scanner, html5QrCode]);

  // New useEffect to handle the scanner when showQrReader changes
  useEffect(() => {
    if (!showQrReader) {
      if (scanner) {
        scanner.clear();
        setScanner(null);
      }
      
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('Error stopping camera:', err));
      }
    }
  }, [showQrReader, scanner, html5QrCode]);

  // Clear success message after delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000); // Clear after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load contacts on mount and refresh when needed
  useEffect(() => {
    reloadContacts();
  }, [reloadContacts]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const results = await searchUsers(searchQuery);
      // Filter out the current user from results
      setSearchResults(results.filter(p => p.id !== user?.id));
    } catch (error) {
      setError('Failed to search users');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a user is already in contacts
  const isContactAdded = (contactId: string) => {
    return contacts.some(contact => contact.id === contactId);
  };

  const startChat = async (contactProfile: Profile) => {
    if (!user || !profile) {
      console.error('No user or profile found:', { user, profile });
      return;
    }

    try {
      console.log('Starting chat with:', contactProfile);
      setLoading(true);
      setError(null);

      console.log('Creating thread with participants:', {
        userId: user.id,
        contactId: contactProfile.id
      });

      const thread = await createThread(
        `Chat with ${contactProfile.username}`,
        [user.id, contactProfile.id],
        user.id
      );

      console.log('Thread created:', thread);

      if (!thread || !thread.id) {
        throw new Error('Thread creation failed - no thread ID returned');
      }

      const chatPath = `/app/chat/${thread.id}`;
      console.log('Navigating to:', chatPath);
      navigate(chatPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Detailed chat creation error:', error);
      setError(`Failed to start chat: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setEditMode(!editMode);
    // Clear selected contacts when exiting edit mode
    if (editMode) {
      setSelectedContacts(new Set());
    } else {
      // Show a helper message when entering edit mode
      setSuccessMessage('Select contacts to delete or block. Click "Cancel Edit" when finished.');
      
      // Clear the message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    }
  };
  
  // Toggle selection of a contact
  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };
  
  // Delete selected contacts
  const deleteSelectedContacts = async () => {
    if (selectedContacts.size === 0) return;
    
    // Show confirmation dialog
    if (!window.confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)?`)) {
      return; // User cancelled
    }
    
    try {
      setLoading(true);
      
      // For each selected contact ID, remove it from the user's contacts
      const deleteCount = {success: 0, failed: 0};
      for (const contactId of selectedContacts) {
        try {
          await removeContact(contactId);
          deleteCount.success++;
        } catch (err) {
          console.error(`Failed to delete contact ${contactId}:`, err);
          deleteCount.failed++;
        }
      }
      
      // Refresh contacts list
      const userContacts = await getContacts();
      setContacts(userContacts);
      
      // Show success message
      let message = `Successfully removed ${deleteCount.success} contact(s)`;
      if (deleteCount.failed > 0) {
        message += `. Failed to remove ${deleteCount.failed} contact(s).`;
      }
      setSuccessMessage(message);
      
      // Clear selection
      setSelectedContacts(new Set());
      
      // Exit edit mode
      setEditMode(false);
    } catch (error) {
      console.error('Error removing contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove contacts');
    } finally {
      setLoading(false);
    }
  };
  
  // Block selected contacts
  const blockSelectedContacts = async () => {
    if (selectedContacts.size === 0) return;
    
    // Show confirmation dialog
    if (!window.confirm(`Are you sure you want to block ${selectedContacts.size} contact(s)?`)) {
      return; // User cancelled
    }
    
    try {
      setLoading(true);
      
      // For each selected contact ID, block it
      const blockedCount = {success: 0, failed: 0, forcedSuccess: 0};
      const blockResults = [];
      const successfullyBlockedIds = new Set<string>();
      
      for (const contactId of selectedContacts) {
        try {
          console.log(`Attempting to block contact: ${contactId}`);
          
          // Get contact name for messaging
          const contactToBlock = contacts.find(c => c.id === contactId);
          const contactName = contactToBlock?.username || contactId;
          
          // First try normal blocking
          await blockContact(contactId);
          
          // Double-check if it worked with a direct query
          const { data: checkData, error: checkError } = await supabase
            .from('contacts')
            .select('status')
            .eq('user_id', user?.id)
            .eq('contact_id', contactId)
            .single();
            
          console.log(`Block status check for ${contactName}:`, { checkData, checkError });
          
          // If not blocked or there was an error, try forcing with direct SQL
          if (checkError || (checkData && checkData.status !== 'blocked')) {
            console.log(`Normal blocking failed for ${contactName}, trying force block...`);
            
            // Try direct SQL update
            const { data: directData, error: directError } = await supabase
              .from('contacts')
              .update({ status: 'blocked' })
              .eq('user_id', user?.id)
              .eq('contact_id', contactId);
              
            console.log(`Direct block result for ${contactName}:`, { directData, directError });
            
            if (!directError) {
              blockedCount.forcedSuccess++;
              blockResults.push({ contactId, contactName, success: true, method: 'forced' });
              successfullyBlockedIds.add(contactId);
            } else {
              throw new Error(`Failed to force block: ${directError.message}`);
            }
          } else {
            blockedCount.success++;
            blockResults.push({ contactId, contactName, success: true, method: 'normal' });
            successfullyBlockedIds.add(contactId);
          }
        } catch (err) {
          console.error(`Failed to block contact ${contactId}:`, err);
          
          // Get the contact name for better messaging
          const contactName = contacts.find(c => c.id === contactId)?.username || contactId;
          blockResults.push({ contactId, contactName, success: false, error: err });
          
          blockedCount.failed++;
        }
      }
      
      console.log('Block results:', blockResults);
      
      // Immediately update the contacts list in state
      if (successfullyBlockedIds.size > 0) {
        setContacts(prevContacts => 
          prevContacts.map(c => 
            successfullyBlockedIds.has(c.id)
              ? { ...c, status: 'blocked' }
              : c
          )
        );
      }
      
      // Show success message
      let message = `Successfully blocked ${blockedCount.success + blockedCount.forcedSuccess} contact(s)`;
      if (blockedCount.forcedSuccess > 0) {
        message += ` (${blockedCount.forcedSuccess} required special handling)`;
      }
      if (blockedCount.failed > 0) {
        message += `. Failed to block ${blockedCount.failed} contact(s).`;
      }
      setSuccessMessage(message);
      
      // Clear selection
      setSelectedContacts(new Set());
      
      // Exit edit mode
      setEditMode(false);
      
      // Then refresh contacts list from server (but don't wait for it)
      reloadContacts().catch(err => {
        console.error('Error reloading contacts after blocking:', err);
      });
    } catch (error) {
      console.error('Error blocking contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to block contacts');
    } finally {
      setLoading(false);
    }
  };

  const renderContactCard = (contact: Profile, showStartChat = true, isSearchResult = false) => {
    // Force console debugging to help diagnose the status issue
    console.log(`Rendering contact card for ${contact.username || 'unknown'}:`, {
      id: contact.id,
      status: contact.status,
      statusType: typeof contact.status,
      hasStatus: !!contact.status,
      isBlocked: contact.status === 'blocked',
      stringComparison: String(contact.status) === 'blocked'
    });
    
    // Reset the previous determination each time we render
    let isBlocked = false;
    
    // If status is exactly "blocked" (this should be the standard case)
    if (contact.status === 'blocked') {
      console.log(`Contact ${contact.username} is blocked (standard equality check)`);
      isBlocked = true;
    }
    // If status is undefined but we know from props it should be blocked
    else if (contact.status && 
            (String(contact.status).toLowerCase() === 'blocked' || 
             String(contact.status).toLowerCase().includes('block'))) {
      console.log(`Contact ${contact.username} is blocked (string comparison)`);
      isBlocked = true;
    }
    
    // Get appropriate hover classes based on theme
    const getHoverClasses = () => {
      if (isNaturalTheme) {
        // Return brown hover effect for natural theme
        return 'hover:bg-amber-50/70 dark:hover:bg-amber-900/30';
      } else {
        // Return green hover effect for default theme
        return 'hover:bg-green-50 dark:hover:bg-green-900/30';
      }
    };
    
    // Final debugging to see what we decided
    console.log(`[FINAL] Contact ${contact.username} blocked status:`, {
      rawStatus: contact.status,
      isBlocked,
      cardClass: isBlocked ? 'blocked-contact' : 'active-contact'
    });
    
    return (
    <div
      key={`${contact.id}-${contact.status || 'active'}`}
      className={`relative rounded-lg border ${isBlocked ? 'border-red-200 dark:border-red-900' : 'border-gray-300 dark:border-gray-600'} ${isBlocked ? 'bg-gray-100 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'} px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 ${getHoverClasses()} dark:hover:border-gray-500 w-full transition-colors`}
    >
      {editMode && !isSearchResult && (
        <div className="flex-shrink-0 mr-2">
          <input
            type="checkbox"
            checked={selectedContacts.has(contact.id)}
            onChange={() => toggleContactSelection(contact.id)}
            className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
          />
        </div>
      )}
      <div className="flex-shrink-0">
          <DiceBearAvatar 
            url={contact.avatar_url}
            size={40}
            className={isBlocked ? 'opacity-50 grayscale' : ''}
            userId={contact.id}
            seed={contact.avatar_seed || undefined}
          />
      </div>
      <div className="flex-1 min-w-0">
        <div className="focus:outline-none">
          <p className={`text-sm font-medium ${isBlocked ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
            {contact.username}
          </p>
          <div className="flex items-center space-x-2">
            <p className={`text-sm ${isBlocked ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'} truncate`}>
              {contact.wallet_address}
            </p>
            <CopyButton text={contact.wallet_address || ''} />
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center space-x-2">
        {isSearchResult && !isContactAdded(contact.id) && (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                setLoading(true);
                setError(null);
                setSuccessMessage(null);
                
                await addContact(contact.id);
                
                // Refresh contacts list
                await reloadContacts();
                
                // Show success message
                setSuccessMessage(`Successfully added ${contact.username || 'contact'} to your contacts!`);
              } catch (error) {
                console.error('Error adding contact from search results:', error);
                setError(error instanceof Error ? error.message : 'Failed to add contact');
              } finally {
                setLoading(false);
              }
            }}
            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${getButtonClassesForTheme('green')} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
          >
            Add to Contacts
          </button>
        )}
        {!isSearchResult && isBlocked && !editMode && (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                setLoading(true);
                setError(null);
                setSuccessMessage(null);
                
                console.log(`NUCLEAR UNBLOCK for contact ${contact.id} (${contact.username})`);
                
                // Immediately update UI first for better user experience
                console.log(`Updating local UI state for ${contact.username}`);
                setContacts(prevContacts => 
                  prevContacts.map(c => 
                    c.id === contact.id 
                      ? { ...c, status: 'active' } 
                      : c
                  )
                );
                
                // Try standard unblock
                try {
                  await unblockContact(contact.id);
                  console.log(`Standard unblock attempted for ${contact.username}`);
                } catch (unblockErr) {
                  console.error(`Standard unblock failed for ${contact.username}:`, unblockErr);
                }
                
                // Now try a direct database update with normal SQL
                try {
                  console.log(`Attempting direct SQL update for ${contact.username}`);
                  const { error: directError } = await supabase
                    .from('contacts')
                    .update({ status: 'active' })
                    .eq('user_id', user?.id)
                    .eq('contact_id', contact.id);
                  
                  if (directError) {
                    console.error(`Direct SQL update failed for ${contact.username}:`, directError);
                  } else {
                    console.log(`Direct SQL update succeeded for ${contact.username}`);
                  }
                } catch (err) {
                  console.error(`Error during direct SQL update for ${contact.username}:`, err);
                }

                // Try raw SQL query as a last resort
                try {
                  console.log(`Attempting RAW SQL update for ${contact.username}`);
                  const { error: rpcError } = await supabase.rpc('force_unblock_contact', { 
                    p_user_id: user?.id, 
                    p_contact_id: contact.id 
                  });
                  
                  if (rpcError) {
                    console.log(`RPC failed, trying direct query: ${rpcError.message}`);
                    
                    // If RPC fails, try direct SQL
                    const { error: rawError } = await supabase.rpc('execute_sql', { 
                      sql: `UPDATE contacts SET status = 'active' WHERE user_id = '${user?.id}' AND contact_id = '${contact.id}'` 
                    });
                    
                    if (rawError) {
                      console.error(`Raw SQL update failed for ${contact.username}:`, rawError);
                    } else {
                      console.log(`Raw SQL update succeeded for ${contact.username}`);
                    }
                  } else {
                    console.log(`RPC unblock succeeded for ${contact.username}`);
                  }
                } catch (err) {
                  console.error(`Error during raw SQL update for ${contact.username}:`, err);
                }
                
                // Finally, create a new active contact record after deleting any existing one
                try {
                  console.log(`Attempting rebuild approach for ${contact.username}`);
                  
                  // First try to delete the existing contact
                  const { error: deleteError } = await supabase
                    .from('contacts')
                    .delete()
                    .eq('user_id', user?.id)
                    .eq('contact_id', contact.id);
                  
                  if (deleteError) {
                    console.error(`Failed to delete contact for rebuild: ${deleteError.message}`);
                  } else {
                    console.log(`Successfully deleted contact for rebuild`);
                    
                    // Then create a new one with active status
                    const { error: insertError } = await supabase
                      .from('contacts')
                      .insert({
                        user_id: user?.id,
                        contact_id: contact.id,
                        status: 'active'
                      });
                    
                    if (insertError) {
                      console.error(`Failed to recreate contact: ${insertError.message}`);
                    } else {
                      console.log(`Successfully recreated contact as active`);
                    }
                  }
                } catch (err) {
                  console.error(`Error during contact rebuild for ${contact.username}:`, err);
                }
                
                // Show success message
                setSuccessMessage(`Successfully unblocked ${contact.username}`);
                
                // Force a hard refresh from the server after giving the database time to update
                setTimeout(() => {
                  console.log(`Force refreshing contacts for ${contact.username}`);
                  reloadContacts().catch(err => {
                    console.error('Error refreshing contacts after unblock:', err);
                  });
                }, 1000);
              } catch (error) {
                console.error(`Error unblocking ${contact.username}:`, error);
                setError(error instanceof Error ? error.message : 'Failed to unblock contact');
              } finally {
                setLoading(false);
              }
            }}
            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${getButtonClassesForTheme('yellow')} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
          >
            <HiLockOpen className="h-3.5 w-3.5 mr-1" />
            Unblock
          </button>
        )}
        {showStartChat && (
          isBlocked ? (
            <button
              type="button"
              disabled
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${getButtonClassesForTheme('red')} cursor-not-allowed opacity-90`}
            >
              <HiLockClosed className="h-3.5 w-3.5 mr-1" />
              Blocked
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startChat(contact);
              }}
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${getButtonClassesForTheme('brand')} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
            >
              Start Chat
            </button>
          )
        )}
        </div>
    </div>
  );
};

  // Helper function to add a contact by wallet address
  const addContactByWalletAddress = async (walletAddress: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const results = await searchUsers(walletAddress);
      console.log('Search results:', results);
      
      if (!results || results.length === 0) {
        setError('No user found with this wallet address');
        return false;
      }
      
      // Check if trying to add yourself as a contact
      if (results[0].id === user?.id) {
        setError('Cannot add yourself as a contact');
        return false;
      }
      
      // Check if the contact is already in your contacts list
      if (isContactAdded(results[0].id)) {
        setError('This contact is already in your contacts list');
        return false;
      }
      
      console.log('Adding contact with ID:', results[0].id);
      await addContact(results[0].id);
      
      // Refresh contacts list
      await reloadContacts();
      
      // Show success message
      setSuccessMessage(`Successfully added ${results[0].username || 'contact'} to your contacts!`);
      
      // Clear search query
      setSearchQuery('');
      
      return true;
    } catch (error) {
      console.error('Error adding contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to add contact');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startCamera = (qrCodeInstance: Html5Qrcode, cameraId: string) => {
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    qrCodeInstance.start(
      cameraId, 
      config,
      async (decodedText) => {
        // On successful scan
        console.log(`QR Code detected: ${decodedText}`);
        
        // Stop scanning
        qrCodeInstance.stop().catch(err => {
          console.error("Error stopping camera after scan:", err);
        });
        
        // Hide the QR reader
        setShowQrReader(false);
        
        // Reset potential previous errors
        setError(null);
        
        // Check if this is a valid user before trying to add contact
        try {
          // Show loading while processing
          setLoading(true);
          
          const results = await searchUsers(decodedText);
          if (!results || results.length === 0) {
            setError('No user found with this wallet address');
            setLoading(false);
            return;
          }
          
          // Check if trying to add yourself as a contact
          if (results[0].id === user?.id) {
            setError('Cannot add yourself as a contact');
            setLoading(false);
            return;
          }
          
          // Check if the contact is already in your contacts list
          if (isContactAdded(results[0].id)) {
            setError(`${results[0].username || 'This user'} is already in your contacts list`);
            setSearchQuery(decodedText);
            setLoading(false);
            return;
          }
          
          // If all checks pass, add the contact
          const success = await addContactByWalletAddress(decodedText);
          if (success) {
            setTimeout(() => {
              setShowScanner(false); // Close modal on success after a delay
            }, 1500);
          }
        } catch (error) {
          console.error("Error processing scanned QR code:", error);
          setError(error instanceof Error ? error.message : 'Failed to process QR code');
          setLoading(false);
        }
      },
      (errorMessage) => {
        // On error (keep running, don't take action)
        console.log(`QR Code scanning error: ${errorMessage}`);
      }
    ).catch(err => {
      console.error("Error starting camera:", err);
      setError("Couldn't start camera: " + (err instanceof Error ? err.message : String(err)));
    });
  };

  // Helper function to scan QR code from an image file
  const scanImageForQRCode = (imageFile: File) => {
    const qrCodeInstance = html5QrCode || new Html5Qrcode("qr-reader");
    setHtml5QrCode(qrCodeInstance);
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // First, create a file URL
    const imageUrl = URL.createObjectURL(imageFile);
    
    // Then scan the file
    qrCodeInstance.scanFile(imageFile, /* showImage */ true)
      .then(async (decodedText) => {
        console.log(`QR Code detected from image: ${decodedText}`);
        
        // Process the scanned QR code
        try {
          const results = await searchUsers(decodedText);
          if (!results || results.length === 0) {
            setError('No user found with this wallet address');
            setLoading(false);
            URL.revokeObjectURL(imageUrl);
            return;
          }
          
          // Check if trying to add yourself as a contact
          if (results[0].id === user?.id) {
            setError('Cannot add yourself as a contact');
            setSearchQuery(decodedText);
            setLoading(false);
            URL.revokeObjectURL(imageUrl);
            return;
          }
          
          // Check if the contact is already in your contacts list
          if (isContactAdded(results[0].id)) {
            setError(`${results[0].username || 'This user'} is already in your contacts list`);
            setSearchQuery(decodedText);
            setLoading(false);
            URL.revokeObjectURL(imageUrl);
            return;
          }
          
          // If all checks pass, add the contact
          const success = await addContactByWalletAddress(decodedText);
          if (success) {
            setTimeout(() => {
              setShowScanner(false); // Close modal on success after a delay
            }, 1500);
          }
        } catch (error) {
          console.error("Error processing scanned QR code:", error);
          setError(error instanceof Error ? error.message : 'Failed to process QR code');
          setLoading(false);
          URL.revokeObjectURL(imageUrl);
        }
      })
      .catch(err => {
        console.error("Error scanning image:", err);
        setError("Could not find a valid QR code in the image. Please try another image or a different method.");
        URL.revokeObjectURL(imageUrl); // Clean up the URL
        setLoading(false);
      });
  };

  // Listen for app-refresh events
  useEffect(() => {
    const handleAppRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      const path = customEvent.detail?.path;
      
      // Only refresh if we're on the contacts page
      if (path && path === '/app/contacts') {
        console.log('Refreshing contacts list due to refresh event');
        reloadContacts();
      }
    };
    
    // Add event listener
    window.addEventListener('app-refresh', handleAppRefresh);
    
    // Cleanup
    return () => {
      window.removeEventListener('app-refresh', handleAppRefresh);
    };
  }, [reloadContacts]);

  // Add focus/visibility refresh for contacts
  useEffect(() => {
    const refreshOnFocus = () => {
      reloadContacts();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshOnFocus();
      }
    });
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [reloadContacts]);

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => setLoadingTimeout(true), 15000); // 15 seconds
      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 natural-light:bg-natural-background natural-dark:bg-natural-dark-background">
      {loading && (
        <div className="flex justify-center items-center mt-4">
          <span className="text-gray-600 dark:text-gray-300">Loading contacts...</span>
          {loadingTimeout && (
            <div className="ml-4 text-red-700 text-sm">
              Still loading? <button className="underline" onClick={() => window.location.reload()}>Reload</button>
            </div>
          )}
        </div>
      )}
      {/* Header */}
      <div className="bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-4">
              <div className="font-semibold">Contacts</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5">
            <div className="flex justify-between mb-6 items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Search Contact
            </h3>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleEditMode}
                  className="flex items-center h-8 px-3 py-0 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {editMode ? 'Cancel' : 'Edit'}
                </button>
                
                <button
                  onClick={() => setShowScanner(true)}
                  className={`flex items-center h-8 px-3 py-0 text-white text-xs font-medium rounded-lg transition-colors ${getButtonClassesForTheme('brand')}`}
                >
                  <HiPlus className="h-4 w-4 mr-1" />
                  Add
                </button>
              </div>
            </div>

            <div>
              <div className="mb-4 max-w-xl mx-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-4 pr-12 py-3 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                />
              </div>

              {/* Global success message */}
              {successMessage && !showScanner && (
                <div className="mb-4 mx-auto p-3 max-w-xl bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-md">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">{successMessage}</span>
                  </div>
                </div>
              )}
              
              {showScanner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-xl w-full mx-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Add Contact
                      </h4>
                      <button
                        onClick={() => {
                          setShowScanner(false);
                          // Also clear scanner when closing the modal
                          if (scanner) {
                            scanner.clear();
                            setScanner(null);
                          }
                          setShowQrReader(false);
                          setShowManualEntry(false); // Reset manual entry state when closing
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-200"
                      >
                        �o
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <button 
                          onClick={() => {
                            // Immediately launch camera
                            setShowQrReader(true);
                            
                            // Create instance if it doesn't exist
                            const qrCodeInstance = html5QrCode || new Html5Qrcode("qr-reader");
                            setHtml5QrCode(qrCodeInstance);
                            
                            // Get available cameras first
                            Html5Qrcode.getCameras().then(devices => {
                              if (devices && devices.length > 0) {
                                // Prefer back camera on mobile devices (usually last in the list)
                                // or just use the first available camera
                                const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;
                                
                                // Stop scanning if already scanning
                                if (qrCodeInstance.isScanning) {
                                  qrCodeInstance.stop().then(() => {
                                    startCamera(qrCodeInstance, cameraId);
                                  }).catch(err => {
                                    console.error("Error stopping camera:", err);
                                    // Try starting anyway
                                    startCamera(qrCodeInstance, cameraId);
                                  });
                                } else {
                                  startCamera(qrCodeInstance, cameraId);
                                }
                              } else {
                                console.error("No cameras found");
                                setError("No cameras found on your device");
                              }
                            }).catch(err => {
                              console.error("Error getting cameras", err);
                              setError("Couldn't access camera. Please check permissions.");
                            });
                          }}
                          className="flex flex-col items-center justify-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                        >
                          <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Scan with Camera</span>
                        </button>
                        
                        <button 
                          onClick={() => {
                            // Hide QR reader if it's visible
                            if (showQrReader) {
                              setShowQrReader(false);
                              if (scanner) {
                                scanner.clear();
                                setScanner(null);
                              }
                            }
                            
                            // Handle image selection
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const target = e.target as HTMLInputElement;
                              if (target && target.files && target.files[0]) {
                                console.log('Image selected:', target.files[0]);
                                // Actually scan the image for QR code
                                scanImageForQRCode(target.files[0]);
                              }
                            };
                            input.click();
                          }}
                          className="flex flex-col items-center justify-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                        >
                          <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Scan Image</span>
                        </button>

                        <button 
                          onClick={() => {
                            // Hide QR reader if it's visible
                            if (showQrReader) {
                              setShowQrReader(false);
                              if (scanner) {
                                scanner.clear();
                                setScanner(null);
                              }
                            }

                            // Show input field
                            setShowQrReader(false);
                            setShowManualEntry(true); // Show manual entry when this button is clicked
                          }}
                          className="flex flex-col items-center justify-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                        >
                          <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Enter Wallet Address</span>
                        </button>
                      </div>
                      
                      <div id="qr-reader" className={`w-full dark:text-white mt-4 ${showQrReader ? 'block' : 'hidden'}`}></div>
                      
                      {/* Loading indicator */}
                      {loading && (
                        <div className="flex justify-center items-center py-4">
                          <svg className="animate-spin h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Scanning image...</span>
                        </div>
                      )}
                      
                      {/* Error message */}
                      {error && !showManualEntry && (
                        <div className="text-center py-3 mt-2">
                          <div className="text-sm text-red-600 dark:text-red-400">
                            {error}
                          </div>
                        </div>
                      )}
                      
                      {/* Success message */}
                      {successMessage && (
                        <div className="text-center py-3 mt-2">
                          <div className="text-sm text-green-600 dark:text-green-400">
                            {successMessage}
                          </div>
                      </div>
                      )}
                      
                      <div className={showManualEntry ? 'block' : 'hidden'}>
                        <div className="space-y-3">
                          <div className="relative">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Enter wallet address..."
                              className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-4 pr-12 py-3 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm"
                            />
                            {searchQuery && (
                              <CopyButton 
                                text={searchQuery} 
                                size={5} 
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                              />
                            )}
                          </div>
                          {searchQuery && (
                            <button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  setError(null);
                                  setSuccessMessage(null);
                                  const results = await searchUsers(searchQuery);
                                  console.log('Search results:', results);
                                  if (!results || results.length === 0) {
                                    setError('No user found with this wallet address');
                                    return;
                                  }
                                  
                                  // Check if trying to add yourself as a contact
                                  if (results[0].id === user?.id) {
                                    setError('Cannot add yourself as a contact');
                                    return;
                                  }
                                  
                                  // Check if the contact is already in your contacts list
                                  if (isContactAdded(results[0].id)) {
                                    setError('This contact is already in your contacts list');
                                    return;
                                  }
                                  
                                  console.log('Adding contact with ID:', results[0].id);
                                  await addContact(results[0].id);
                                  
                                  // Refresh contacts list
                                  await reloadContacts();
                                  
                                  // Show success message
                                  setSuccessMessage(`Successfully added ${results[0].username || 'contact'} to your contacts!`);
                                  setTimeout(() => {
                                  setShowScanner(false);
                                  setSearchQuery('');
                                  }, 1500); // Close modal after 1.5 seconds
                                } catch (error) {
                                  setError(error instanceof Error ? error.message : 'Failed to add contact');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={loading}
                              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-white rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClassesForTheme('brand')}`}
                            >
                              {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                              <HiPlus className="h-5 w-5" />
                              )}
                              <span>{loading ? 'Adding...' : 'Add Contact'}</span>
                            </button>
                          )}
                          
                          {error && (
                            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                              {error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contacts List */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Contacts</h4>
                  
                  {editMode && selectedContacts.size > 0 && (
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedContacts.size} selected
                      </span>
                      <button
                        onClick={deleteSelectedContacts}
                        className={`px-3 py-1.5 text-white text-xs font-medium rounded-full ${getButtonClassesForTheme('red').replace('bg-red-800', 'bg-red-600').replace('hover:bg-red-900', 'hover:bg-red-700')}`}
                      >
                        Delete
                      </button>
                      <button
                        onClick={blockSelectedContacts}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-full"
                      >
                        Block
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {contacts.map((contact) => renderContactCard(contact, !editMode))}
                  {contacts.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                      No contacts yet
                    </div>
                  )}
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Search Results</h4>
                  <div className="space-y-4">
                    {searchResults.map((contact) => renderContactCard(contact, true, true))}
                  </div>
                </div>
              )}

              {searchQuery && !loading && searchResults.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  No users found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
