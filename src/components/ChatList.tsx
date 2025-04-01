import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { getUserThreads, subscribeToUserThreads, getProfile, subscribeToThread, deleteThread } from '../utils/supabase/index';
import { HiPlus, HiUser, HiTrash, HiX, HiCheck, HiSelector, HiPencil } from 'react-icons/hi';
import { Avatar } from './Avatar';
import type { Database } from '../types/supabase';
import { supabase } from '../utils/supabase/index';
import { checkAndDeleteExpiredMessages } from '../utils/supabase/autoDelete';

type Thread = Database['public']['Tables']['threads']['Row'] & {
  messages: Database['public']['Tables']['messages']['Row'][];
  otherParticipant?: {
    username: string;
    avatar_url: string | null;
  };
};

// Define the Message type
type Message = Database['public']['Tables']['messages']['Row'];

export const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { 
    notificationsEnabled, 
    showNotification, 
    incrementUnread,
    playNotificationSound 
  } = useNotification();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Keep track of threads with unread messages
  const [unreadThreads, setUnreadThreads] = useState<Record<string, number>>({});
  // Keep track of our own subscriptions for cleanup
  const messageUnsubscribesRef = useRef<(() => void)[]>([]);
  // State for delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Multi-select functionality
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedThreads, setSelectedThreads] = useState<string[]>([]);
  // Display wallet addresses in shortened form
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  // Filter threads based on search query
  const filteredThreads = threads.filter(thread => 
    thread.otherParticipant?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getLastMessage(thread).toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (user) {
      loadThreadsWithParticipants();
      
      // Subscribe to new threads
      const userThreadUnsubscribe = subscribeToUserThreads(user.id, (payload) => {
        console.log('New thread notification received:', payload);
        if (payload.new) {
          // Refresh threads list to include the new thread
          loadThreadsWithParticipants();
          
          // Show notification if the thread was created by someone else
          if (payload.new.created_by !== user.id) {
            // Use enhanced notification system
            if (notificationsEnabled && !document.hasFocus()) {
              showNotification('New Chat', {
                body: `New chat: ${payload.new.name}`,
                data: {
                  threadId: payload.new.id,
                  url: `/app/chat/${payload.new.id}`
                },
                tag: `thread-${payload.new.id}`
              });
              
              // Increment unread counter
              incrementUnread();
              
              // Update unread threads state
              setUnreadThreads(prev => ({
                ...prev,
                [payload.new.id]: (prev[payload.new.id] || 0) + 1
              }));
            }
          }
        }
      });

      // Setup subscriptions for existing threads
      const setupThreadSubscriptions = async () => {
        if (threads.length > 0) {
          // Clean up any previous message subscriptions
          messageUnsubscribesRef.current.forEach(unsub => unsub());
          messageUnsubscribesRef.current = [];
          
          threads.forEach(thread => {
            // Add subscription for each thread to track new messages
            const unsubscribe = subscribeToThread(
              thread.id, 
              (payload: { new: Message; old: Message | null }) => {
                if (payload.new && payload.new.sender_id !== user.id) {
                  console.log('New message in thread:', thread.id, payload.new);
                  
                  // Update unread count for this thread
                  setUnreadThreads(prev => ({
                    ...prev,
                    [thread.id]: (prev[thread.id] || 0) + 1
                  }));
                  
                  // Also refresh the threads to update last_message timestamp
                  loadThreadsWithParticipants();
                  
                  // Show visual notification if not in focus and notifications are enabled
                  if (notificationsEnabled && !document.hasFocus()) {
                    const senderName = thread.otherParticipant?.username || 'Someone';
                    showNotification(`New message from ${senderName}`, {
                      body: payload.new.content,
                      data: {
                        threadId: thread.id,
                        url: `/app/chat/${thread.id}`
                      },
                      tag: `thread-${thread.id}`
                    });
                    
                    // Increment global unread counter
                    incrementUnread();
                  }
                }
              },
              (updatePayload) => {
                // Handle thread updates
                if (updatePayload && updatePayload.new) {
                  console.log(`Thread ${thread.id} updated:`, updatePayload);
                  
                  // Refresh threads to get updated data like last_message_at
                  loadThreadsWithParticipants();
                }
              }
            );
            
            // Track this subscription for cleanup
            messageUnsubscribesRef.current.push(unsubscribe);
          });
        }
      };
      
      // Setup subscriptions when threads are loaded
      if (threads.length > 0) {
        setupThreadSubscriptions();
      }

      return () => {
        if (userThreadUnsubscribe) {
          userThreadUnsubscribe();
        }
        
        // Clean up all message subscriptions
        messageUnsubscribesRef.current.forEach(unsub => {
          unsub();
        });
        messageUnsubscribesRef.current = [];
      };
    }
  }, [user, notificationsEnabled, showNotification, incrementUnread, threads.length]);

  const loadThreadsWithParticipants = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!user) {
        setLoading(false);
        return;
      }

      // Check for expired messages before loading threads
      if (user.id) {
        try {
          const deletedCount = await checkAndDeleteExpiredMessages(user.id);
          if (deletedCount > 0) {
            console.log(`Auto-deleted ${deletedCount} expired messages`);
          }
        } catch (error) {
          console.error('Error checking for expired messages:', error);
        }
      }
      
      // Get threads with participant details
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

      // Initialize unread counters for each thread
      const unreadCounters: Record<string, number> = {};
      
      // For each thread, count unread messages
      await Promise.all(threadsWithParticipants.map(async (thread: Thread) => {
        try {
          // Fetch messages for this thread
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('thread_id', thread.id)
            .eq('read', false)
            .neq('sender_id', user.id); // Only count messages not sent by current user
            
          // Set unread count for this thread
          if (messagesData && messagesData.length > 0) {
            unreadCounters[thread.id] = messagesData.length;
          }
        } catch (error) {
          console.error(`Error counting unread messages for thread ${thread.id}:`, error);
        }
      }));
      
      // Update unread threads state with the initial counts
      setUnreadThreads(unreadCounters);
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
    // Truncate long messages for the preview
    const message = thread.messages[0].content;
    // Return a shorter preview for mobile
    return message.length > 30 ? message.substring(0, 27) + '...' : message;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday`;
    } else if (days < 7) {
      return `${date.toLocaleDateString([], { weekday: 'short' })}`;
    } else {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
  };
  
  // Shorten wallet address for display
  const shortenAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 15) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      // If turning off selection mode, clear selections
      setSelectedThreads([]);
    }
  };

  // Select all threads
  const selectAllThreads = () => {
    if (selectedThreads.length === filteredThreads.length) {
      // If all are selected, deselect all
      setSelectedThreads([]);
    } else {
      // Otherwise, select all
      setSelectedThreads(filteredThreads.map(thread => thread.id));
    }
  };

  // Toggle thread selection
  const toggleThreadSelection = (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigating to the chat
    
    if (selectedThreads.includes(threadId)) {
      setSelectedThreads(selectedThreads.filter(id => id !== threadId));
    } else {
      setSelectedThreads([...selectedThreads, threadId]);
    }
  };

  // Toggle expanded view for a thread (to see full wallet address)
  const toggleExpandThread = (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigating to the chat
    if (expandedThread === threadId) {
      setExpandedThread(null);
    } else {
      setExpandedThread(threadId);
    }
  };

  // Handle opening the delete confirmation dialog
  const handleOpenDeleteDialog = (threadId: string | null, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent navigating to the chat
    }
    
    setThreadToDelete(threadId);
    setShowDeleteDialog(true);
    setDeleteError(null);
  };

  // Open delete dialog for multiple chats
  const openMultiDeleteDialog = () => {
    if (selectedThreads.length === 0) return;
    setShowDeleteDialog(true);
    setDeleteError(null);
  };

  // Handle the deletion of a thread
  const handleDeleteThread = async () => {
    if (!user) return;
    
    setDeleteLoading(true);
    setDeleteError(null);
    
    try {
      // Determine which threads to delete
      const threadsToDelete = threadToDelete 
        ? [threadToDelete] 
        : selectedThreads;
      
      // Delete each thread
      for (const threadId of threadsToDelete) {
        await deleteThread(threadId, user.id);
      }
      
      // Remove the deleted threads from the local state
      setThreads(prevThreads => prevThreads.filter(thread => 
        !threadsToDelete.includes(thread.id)
      ));
      
      // Also remove from unread threads
      setUnreadThreads(prev => {
        const newState = { ...prev };
        threadsToDelete.forEach(threadId => {
          delete newState[threadId];
        });
        return newState;
      });
      
      // Clear selections
      setSelectedThreads([]);
      
      // Exit selection mode if no threads left selected
      if (selectedThreads.length === threadsToDelete.length) {
        setSelectionMode(false);
      }
      
      // Close the dialog
      setShowDeleteDialog(false);
      setThreadToDelete(null);
    } catch (error) {
      console.error('Error deleting thread(s):', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete chat(s)');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Close the delete dialog
  const handleCloseDeleteDialog = () => {
    setShowDeleteDialog(false);
    setThreadToDelete(null);
    setDeleteError(null);
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
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-3">
          <div className="px-3 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base leading-6 font-medium text-gray-900 dark:text-white">
                Search Chats
              </h3>
              {selectionMode ? (
                <div className="flex items-center space-x-3">
                  {filteredThreads.length > 0 && (
                    <button
                      onClick={selectAllThreads}
                      className="flex items-center space-x-1 text-xs text-brand-primary hover:text-brand-secondary px-2 py-1 border border-transparent rounded-md"
                    >
                      <HiSelector size={14} />
                      <span>{selectedThreads.length === filteredThreads.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                  )}
                  {selectedThreads.length > 0 ? (
                    <button 
                      onClick={openMultiDeleteDialog}
                      className="flex items-center space-x-1 text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md"
                    >
                      <HiTrash size={14} />
                      <span>Delete ({selectedThreads.length})</span>
                    </button>
                  ) : (
                    <button 
                      onClick={toggleSelectionMode}
                      className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md"
                    >
                      <HiX size={14} />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={toggleSelectionMode}
                  className="flex items-center space-x-1 text-xs text-brand-primary hover:text-brand-secondary px-2 py-1 border border-brand-primary/20 rounded-md"
                >
                  <HiPencil size={14} />
                  <span>Edit</span>
                </button>
              )}
            </div>
            <div className="w-full">
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                />
              </div>
            </div>
          </div>
        </div>
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50">
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
              <div key={thread.id} className="px-2">
                <div
                  className={`rounded-md my-1 ${
                    thread.id === window.location.pathname.split('/').pop() ? 'bg-green-100 dark:bg-green-900/50' : ''
                  } ${selectedThreads.includes(thread.id) ? 'bg-green-100 dark:bg-green-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                >
                  <div className="grid grid-cols-12 items-center gap-1 py-2">
                    {/* Selection checkbox in selection mode */}
                    {selectionMode && (
                      <div 
                        className="col-span-1 flex justify-center items-center"
                        onClick={(e) => toggleThreadSelection(thread.id, e)}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          selectedThreads.includes(thread.id) 
                            ? 'bg-brand-primary border-brand-primary' 
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedThreads.includes(thread.id) && (
                            <HiCheck className="text-white" size={14} />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Avatar */}
                    <div className={`${selectionMode ? 'col-span-2' : 'col-span-2'} flex justify-center`}>
                      <Avatar 
                        url={thread.otherParticipant?.avatar_url}
                        size={36}
                        className="flex-shrink-0"
                      />
                    </div>
                    
                    {/* Chat Content */}
                    <div 
                      className={`${selectionMode ? 'col-span-8' : 'col-span-9'} flex flex-col min-w-0 pr-1`}
                      onClick={() => {
                        if (selectionMode) {
                          toggleThreadSelection(thread.id, { stopPropagation: () => {} } as React.MouseEvent);
                        } else {
                          // Clear unread counter for this thread when clicked
                          if (unreadThreads[thread.id]) {
                            setUnreadThreads(prev => ({
                              ...prev,
                              [thread.id]: 0
                            }));
                          }
                          navigate(`/app/chat/${thread.id}`);
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {thread.otherParticipant?.username || 'Chat'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 ml-1 whitespace-nowrap">
                          {thread.last_message_at ? formatDate(thread.last_message_at) : ''}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                        {getLastMessage(thread)}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className={`${selectionMode ? 'col-span-1' : 'col-span-1'} flex justify-center`}>
                      {!selectionMode ? (
                        <button
                          onClick={(e) => handleOpenDeleteDialog(thread.id, e)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Delete chat"
                        >
                          <HiTrash size={16} />
                        </button>
                      ) : (
                        unreadThreads[thread.id] && unreadThreads[thread.id] > 0 && (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white text-xs font-medium">
                            {unreadThreads[thread.id] > 9 ? '9+' : unreadThreads[thread.id]}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {threadToDelete ? "Delete Chat" : `Delete ${selectedThreads.length} Chats`}
              </h3>
              <button
                onClick={handleCloseDeleteDialog}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <HiX size={24} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                {threadToDelete 
                  ? "Are you sure you want to delete this chat? All messages will be permanently removed and cannot be recovered."
                  : `Are you sure you want to delete ${selectedThreads.length} chats? All messages will be permanently removed and cannot be recovered.`
                }
              </p>
              
              {deleteError && (
                <div className="mt-4 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded">
                  {deleteError}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCloseDeleteDialog}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteThread}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
