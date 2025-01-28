import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { searchUsers, createThread } from '../utils/supabase';
import { HiUser } from 'react-icons/hi';
import type { Database } from '../types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export const ContactList: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const chatPath = `/chat/${thread.id}`;
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

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="font-semibold">Contacts</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Find Contacts
            </h3>

            <div className="max-w-xl">
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-4 pr-12 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                />
                {loading && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <svg className="animate-spin h-5 w-5 text-gray-400 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
                {searchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="relative rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 dark:hover:border-gray-500"
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
                          <span className="text-gray-500 dark:text-gray-300 font-medium">
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {contact.wallet_address}
                        </p>
                      </div>
                    </div>
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
                  </div>
                ))}

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
    </div>
  );
};
