import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { searchUsers, createThread, addContact, getContacts } from '../utils/supabase';
import { HiUser, HiPlus } from 'react-icons/hi';
import { CopyButton } from './CopyButton';
import type { Database } from '../types/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Modify the Profile type to make updated_at optional to handle potential missing values
type Profile = Database['public']['Tables']['profiles']['Row'];

export const ContactList: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);

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
    } else if (scanner) {
      scanner.clear();
      setScanner(null);
    }

    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [showScanner]);

  // Load contacts on mount and refresh when needed
  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Loading contacts...');
        const userContacts = await getContacts();
        console.log('Contacts loaded:', userContacts);
        if (userContacts && Array.isArray(userContacts)) {
          setContacts(userContacts);
        } else {
          console.error('Invalid contacts data:', userContacts);
          setError('Failed to load contacts: Invalid data format');
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
        setError(error instanceof Error ? error.message : 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };
    loadContacts();
  }, []);

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

  const renderContactCard = (contact: Profile, showStartChat = true) => (
    <div
      key={contact.id}
      className="relative rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 dark:hover:border-gray-500 w-full"
    >
      <div className="flex-shrink-0">
        {contact.avatar_url ? (
          <img
            className="h-10 w-10 rounded-full"
            src={contact.avatar_url}
            alt={contact.username}
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-gray-500 dark:text-white font-medium">
              {contact.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="focus:outline-none">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {contact.username}
          </p>
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {contact.wallet_address}
            </p>
            <CopyButton text={contact.wallet_address || ''} />
          </div>
        </div>
      </div>
      {showStartChat && (
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startChat(contact);
            }}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
          >
            Start Chat
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-4">
              <div className="font-semibold">Contacts</div>
              <button
                onClick={() => setShowScanner(!showScanner)}
                className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <HiPlus className="h-5 w-5 mr-2" />
                Add Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Search Contact
            </h3>

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
              {showScanner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-xl w-full mx-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Add Contact
                      </h4>
                      <button
                        onClick={() => setShowScanner(false)}
                        className="text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-200"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Scan QR Code
                        </h5>
                        <div id="qr-reader" className="w-full dark:text-white"></div>
                      </div>
                      
                      <div className="text-center text-sm text-gray-700 dark:text-white">
                        or
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Enter Wallet Address
                        </h5>
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Enter wallet address..."
                              className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-4 pr-12 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
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
                                  const results = await searchUsers(searchQuery);
                                  console.log('Search results:', results);
                                  if (!results || results.length === 0) {
                                    setError('No user found with this wallet address');
                                    return;
                                  }
                                  console.log('Adding contact with ID:', results[0].id);
                                  await addContact(results[0].id);
                                  // Refresh contacts list
                                  const userContacts = await getContacts();
                                  setContacts(userContacts);
                                  setShowScanner(false);
                                  setSearchQuery('');
                                } catch (error) {
                                  setError(error instanceof Error ? error.message : 'Failed to add contact');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={loading}
                              className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <HiPlus className="h-5 w-5" />
                              <span>Add Contact</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contacts List */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Your Contacts</h4>
                <div className="space-y-4">
                  {contacts.map((contact) => renderContactCard(contact))}
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
                    {searchResults.map((contact) => renderContactCard(contact))}
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
