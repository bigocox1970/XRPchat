import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getUserThreads, subscribeToUserThreads, getProfile } from '../utils/supabase';
import { HiPlus, HiDotsVertical, HiUser } from 'react-icons/hi';
import { Avatar } from './Avatar';
import type { Database } from '../types/supabase';

type Thread = Database['public']['Tables']['threads']['Row'] & {
  messages: Database['public']['Tables']['messages']['Row'][];
  otherParticipant?: {
    username: string;
    avatar_url: string | null;
  };
};

export const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter threads based on search query
  const filteredThreads = threads.filter(thread => 
    thread.otherParticipant?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getLastMessage(thread).toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (user) {
      loadThreadsWithParticipants();
      
      // Subscribe to new threads
      const unsubscribe = subscribeToUserThreads(user.id, (payload) => {
        console.log('New thread notification received:', payload);
        if (payload.new) {
          // Refresh threads list to include the new thread
          loadThreadsWithParticipants();
          
          // Show notification if the thread was created by someone else
          if (payload.new.created_by !== user.id) {
            // Use browser notification if available
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Chat', {
                body: `New chat: ${payload.new.name}`,
              });
            }
          }
        }
      });

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      return () => {
        unsubscribe();
      };
    }
  }, [user]);

  const loadThreadsWithParticipants = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const threads = await getUserThreads(user.id);
      
      // Load participant profiles for each thread
      const threadsWithParticipants = await Promise.all(
        threads.map(async (thread) => {
          const otherParticipantId = thread.participant_ids.find((id: string) => id !== user.id);
          if (otherParticipantId) {
            const profile = await getProfile(otherParticipantId);
            return {
              ...thread,
              otherParticipant: profile ? {
                username: profile.username,
                avatar_url: profile.avatar_url
              } : undefined
            };
          }
          return thread;
        })
      );

      setThreads(threadsWithParticipants);
    } catch (error) {
      console.error('Error loading threads:', error);
      setError('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const getLastMessage = (thread: Thread) => {
    if (!thread.messages || thread.messages.length === 0) {
      return 'No messages yet';
    }
    return thread.messages[0].content;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${date.toLocaleDateString([], { weekday: 'long' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f0f2f5] dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="font-semibold">Chats</div>
          </div>
        </div>
        <button
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Menu"
        >
          <HiDotsVertical size={24} />
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-4">
          <div className="px-4 py-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Search Chats
            </h3>
            <div className="max-w-xl">
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-4 pr-12 py-3 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                />
              </div>
            </div>
          </div>
        </div>
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50">
            {error}
          </div>
        )}

        {filteredThreads.length === 0 && threads.length > 0 ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            No chats found
          </div>
        ) : threads.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No chats yet</p>
              <button
                onClick={() => navigate('/app/contacts')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#075e54] hover:bg-[#128c7e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Start a chat
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow rounded-lg">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => navigate(`/app/chat/${thread.id}`)}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <div className="px-4 py-4 sm:px-6 flex items-center">
                  <Avatar 
                    url={thread.otherParticipant?.avatar_url}
                    size={48}
                    className="flex-shrink-0"
                  />
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {thread.otherParticipant ? `Chat with ${thread.otherParticipant.username}` : 'Chat'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {thread.last_message_at ? formatDate(thread.last_message_at) : ''}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {getLastMessage(thread)}
                    </p>
                  </div>
                  {thread.messages?.some(m => !m.read && m.sender_id !== user?.id) && (
                    <div className="ml-4">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#25d366] text-white text-xs font-medium">
                        {thread.messages.filter(m => !m.read && m.sender_id !== user?.id).length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/app/contacts')}
        className="fixed right-6 bottom-6 p-4 rounded-full bg-brand-secondary text-white shadow-lg hover:bg-brand-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary z-10"
        aria-label="New chat"
      >
        <HiPlus size={24} />
      </button>
    </div>
  );
};
