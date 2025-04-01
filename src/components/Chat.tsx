import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useEncryption } from '../context/EncryptionContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useDebugMode } from '../context/DebugModeContext';
import { supabase, getThreadMessages, sendMessage, markMessageAsRead, subscribeToThread, getProfile, updateLastActive } from '../utils/supabase/index';
import { HiX, HiPaperAirplane, HiClock, HiRefresh } from 'react-icons/hi';
import { Avatar } from './Avatar';
import type { Database } from '../types/supabase';
import { 
  checkAndDeleteExpiredMessages, 
  getAutoDeleteSettings, 
  getAutoDeleteMilliseconds,
  getOtherUserAutoDeleteSettings
} from '../utils/supabase/autoDelete';

type Message = Database['public']['Tables']['messages']['Row'];

interface ThreadDetails {
  name: string;
  participant_ids: string[];
}

interface ParticipantProfile {
  username: string;
  avatar_url: string | null;
  last_active: string | null;
}

interface ThreadParticipants {
  [key: string]: ParticipantProfile;
}

// Add interface for auto-delete info
interface AutoDeleteInfo {
  userInfo: {
    enabled: boolean;
    timeDisplay: string;
  };
  otherUserInfo: {
    enabled: boolean;
    timeDisplay: string;
  } | null;
}

const MessageContent: React.FC<{
  content: string;
  showEncrypted: boolean;
}> = ({ content, showEncrypted }) => {
  const { decryptMessage } = useEncryption();
  const [decryptedContent, setDecryptedContent] = useState<string>(content);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptionFailed, setDecryptionFailed] = useState(false);
  // Add a ref to track decryption attempts
  const decryptionAttempts = useRef(0);
  const maxAttempts = 2; // Maximum number of decryption attempts

  // Reset attempts when content changes
  useEffect(() => {
    decryptionAttempts.current = 0;
  }, [content]);

  // When showEncrypted changes, we need to force a re-decryption if needed
  useEffect(() => {
    // If we're switching to "show decrypted" mode and haven't successfully decrypted yet or previously failed
    if (!showEncrypted && (!isDecrypted || decryptionFailed)) {
      // Only reset if we haven't exceeded max attempts
      if (decryptionAttempts.current < maxAttempts) {
        setIsDecrypted(false); // Mark as not decrypted to trigger decryption
        setDecryptionFailed(false); // Reset failure status
      }
    }
  }, [showEncrypted, isDecrypted, decryptionFailed]);

  useEffect(() => {
    let mounted = true;

    const decrypt = async () => {
      // Prevent decryption if max attempts reached
      if (decryptionAttempts.current >= maxAttempts) {
        return;
      }

      if (!isDecrypted && !showEncrypted) {
        decryptionAttempts.current += 1;
        
        try {
          // Check if the content looks like a valid encrypted message (base64)
          const isBase64 = /^[A-Za-z0-9+/=]+$/.test(content);
          if (!isBase64) {
            // If it's not a valid base64 string, don't attempt to decrypt
            if (mounted) {
              setDecryptedContent(content); // Just display the original content
              setIsDecrypted(true);
              setDecryptionFailed(false);
            }
            return;
          }

          const decrypted = await decryptMessage(content);
          if (mounted) {
            setDecryptedContent(decrypted);
            setIsDecrypted(true);
            setDecryptionFailed(false);
          }
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          if (mounted) {
            // For failed decryption, show a friendly error instead of raw encrypted content
            setDecryptedContent("⚠️ Could not decrypt this message. Toggle to see encrypted format.");
            setIsDecrypted(true);
            setDecryptionFailed(true);
          }
        }
      }
    };

    if (!isDecrypted && !showEncrypted) {
      decrypt();
    }

    return () => {
      mounted = false;
    };
  }, [content, decryptMessage, isDecrypted, showEncrypted]);

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {showEncrypted ? (
        <span className="font-mono text-xs">{content}</span>
      ) : (
        <span className={decryptionFailed ? "text-red-500 italic" : ""}>
          {decryptedContent}
        </span>
      )}
    </p>
  );
};

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const [participants, setParticipants] = useState<ThreadParticipants>({});
  const { id: threadId } = useParams<{ id: string }>();
  const { user } = useUser();
  const { notificationsEnabled, showNotification, incrementUnread, clearUnread } = useNotification();
  const { encryptForRecipient, decryptMessage } = useEncryption();
  const { showEncrypted } = useEncryptionMode();
  const { debugMode } = useDebugMode();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoDeleteInfo, setAutoDeleteInfo] = useState<AutoDeleteInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Capture console output in debug mode
  useEffect(() => {
    if (!debugMode) return;

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setDebugLogs(prev => [...prev, `[LOG] ${message}`]);
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setDebugLogs(prev => [...prev, `[ERROR] ${message}`]);
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  }, [debugMode]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Validate thread ID and handle navigation
  useEffect(() => {
    if (!threadId || threadId === 'new') {
      navigate('/app/contacts');
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(threadId)) {
      navigate('/app');
      return;
    }
  }, [threadId, navigate]);

  // Load thread details
  useEffect(() => {
    const loadThreadDetails = async () => {
      if (!threadId || !user || threadId === 'new') return;
      
      try {
        const { data, error } = await supabase
          .from('threads')
          .select('name, participant_ids')
          .eq('id', threadId)
          .single();
          
        if (error) {
          setError('Failed to load chat. Please try again.');
          return;
        }
        
        if (!data) {
          navigate('/app');
          return;
        }

        // Verify user is a participant
        if (!data.participant_ids.includes(user.id)) {
          navigate('/app');
          return;
        }

        setThreadDetails(data);
        
        // Load participant profiles
        try {
          const profiles = await Promise.all(
            data.participant_ids.map(async (id: string) => {
              try {
                const profile = await getProfile(id);
                return { id, profile };
              } catch (error) {
                console.error(`Error loading profile for ${id}:`, error);
                return { 
                  id, 
                  profile: {
                    username: 'Unknown User',
                    avatar_url: null,
                    last_active: new Date().toISOString()
                  }
                };
              }
            })
          );

          const participantMap = profiles.reduce((acc, { id, profile }) => {
            acc[id] = {
              username: profile.username,
              avatar_url: profile.avatar_url,
              last_active: profile.last_active || new Date().toISOString()
            };
            return acc;
          }, {} as ThreadParticipants);

          setParticipants(participantMap);
        } catch (error) {
          console.error('Error loading participant profiles:', error);
        }
      } catch (error) {
        setError('Failed to load chat. Please try again.');
      }
    };

    loadThreadDetails();
  }, [threadId, user, navigate]);

  // Add a console log when the component mounts to track loading
  useEffect(() => {
    console.log(`Chat component mounted/updated for thread: ${threadId} at path: ${location.pathname}`);
  }, [threadId, location.pathname]);

  // Load messages and handle subscriptions
  useEffect(() => {
    const loadMessages = async () => {
      if (!threadId || !user) return;
      
      // Set loading to true at the start
      setLoading(true);
      
      try {
        // Check for expired messages before loading
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
        
        console.log(`Loading messages for thread ${threadId} at path ${location.pathname}`);
        const messages = await getThreadMessages(threadId);
        setMessages(messages.reverse()); // Reverse to show oldest first
        
        // When entering a thread, clear unread counter for this thread
        clearUnread();
        
        // Mark unread messages as read - only for messages sent TO the current user
        const unreadMessages = messages.filter(msg => !msg.read && msg.sender_id !== user.id);
        console.log(`Marking ${unreadMessages.length} messages as read in thread ${threadId}`);
        
        if (unreadMessages.length > 0) {
          await Promise.all(unreadMessages.map(async (message) => {
            try {
              // Only update the message read status, not the profile
              await markMessageAsRead(message.id, user.id);
            } catch (error) {
              console.error(`Error marking message ${message.id} as read:`, error);
            }
          }));
        }
        
        // Update user's last active time
        if (user.id) {
          try {
            await updateLastActive(user.id);
          } catch (error) {
            console.error('Error updating last active time:', error);
          }
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    // Reset messages when changing threads
    setMessages([]);
    loadMessages();

    // Subscribe to new messages
    if (!threadId) return;

    const unsubscribe = subscribeToThread(
      threadId,
      async (payload) => {
        if (payload.new && user) {
          const message = payload.new;
          
          // Mark message as read immediately if it's not from the current user
          // and the user is actively viewing this chat thread
          if (message.sender_id !== user.id && document.hasFocus()) {
            console.log(`Marking new message ${message.id} as read immediately`);
            try {
              await markMessageAsRead(message.id, user.id);
            } catch (error) {
              console.error(`Error marking new message ${message.id} as read:`, error);
            }
          }
          
          // Add message to state FIRST, before trying to show notification
          // This ensures messages appear immediately even if notification fails
          setMessages(prev => {
            // Check if message already exists
            if (prev.some(m => m.id === message.id)) {
              return prev;
            }
            // Sort messages by creation time to maintain order
            return [...prev, message].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
          
          // Show notification if it's from another user
          try {
            // Check both our state and localStorage to make absolutely sure notifications are wanted
            const userWantsNotifications = 
              notificationsEnabled && 
              Notification.permission === 'granted' && 
              localStorage.getItem('xrpchat_notification_permission') !== 'disabled';
            
            // Only show notification if explicitly enabled and window is not focused
            if (userWantsNotifications && !document.hasFocus()) {
              const senderName = participants[message.sender_id]?.username || 'Someone';
              
              // Add try/catch specifically around decryption
              let decryptedContent = 'New message';
              try {
                // Skip decryption if showing encrypted content
                decryptedContent = showEncrypted ? 'New encrypted message' : 
                  await decryptMessage(message.content);
              } catch (decryptError) {
                console.error('Error decrypting message for notification:', decryptError);
                decryptedContent = 'New encrypted message'; // Fallback content
              }
              
              try {
                showNotification(`New message from ${senderName}`, {
                  body: decryptedContent,
                  data: {
                    threadId: threadId,
                    url: `/app/chat/${threadId}`
                  },
                  tag: `thread-${threadId}`,
                  senderId: message.sender_id // Pass the sender ID to ensure it's not our own message
                } as any); // Cast to any to allow our custom property
                
                // Increment unread counter
                incrementUnread();
              } catch (notificationError) {
                console.error('Error showing notification:', notificationError);
              }
            }
          } catch (error) {
            // This catch won't block message display since we update state first
            console.error('Error handling notification:', error);
          }
        }
      },
      () => {}
    );

    return () => {
      unsubscribe();
    };
  }, [threadId, user, notificationsEnabled, showNotification, incrementUnread, clearUnread, location.pathname, participants, decryptMessage, showEncrypted]);

  // Also add an effect to mark messages as read when user focuses window
  useEffect(() => {
    if (!threadId || !user || !messages.length) return;
    
    const handleFocus = async () => {
      const unreadMessages = messages.filter(msg => !msg.read && msg.sender_id !== user.id);
      
      if (unreadMessages.length > 0) {
        console.log(`Focus event: Marking ${unreadMessages.length} messages as read`);
        
        await Promise.all(unreadMessages.map(async (message) => {
          try {
            await markMessageAsRead(message.id, user.id);
          } catch (error) {
            console.error(`Error marking message ${message.id} as read on focus:`, error);
          }
        }));
        
        // Update the messages to reflect the read status
        setMessages(prev => 
          prev.map(msg => 
            unreadMessages.some(unread => unread.id === msg.id) 
              ? { ...msg, read: true } 
              : msg
          )
        );
      }
    };
    
    // Add event listener for window focus
    window.addEventListener('focus', handleFocus);
    
    // Mark messages as read immediately if window is already focused
    if (document.hasFocus()) {
      handleFocus();
    }
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [threadId, user, messages]);

  // Scroll to bottom on mount, new messages, and when loading completes
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Initial scroll on mount
    scrollToBottom();

    // Scroll when messages load or update
    if (messages.length > 0) {
      const timeout = setTimeout(scrollToBottom, 250);
      return () => clearTimeout(timeout);
    }
  }, [messages.length, loading]);

  // Additional scroll when loading completes
  useEffect(() => {
    if (!loading && messages.length > 0) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Focus input when ?focus=reply is in the URL (from notification action)
  useEffect(() => {
    // Check for focus=reply in query params
    const params = new URLSearchParams(location.search);
    if (params.get('focus') === 'reply' && inputRef.current) {
      // Focus the input field with a slight delay to ensure the component is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
        // Remove the query parameter to avoid focusing again on re-renders
        const newUrl = location.pathname;
        navigate(newUrl, { replace: true });
      }, 500);
    }
  }, [location, navigate]);

  // Update effect to check both users' auto-delete settings and set the information
  useEffect(() => {
    const fetchAutoDeleteSettings = async () => {
      if (!threadDetails || !user) return;
      
      // Get current user's settings
      const currentUserSettings = getAutoDeleteSettings();
      const currentUserMs = getAutoDeleteMilliseconds(currentUserSettings);
      
      // Find the other participant's ID
      const otherParticipantId = threadDetails.participant_ids.find(id => id !== user.id);
      
      let otherUserSettings = null;
      let otherUserMs = null;
      
      // Get other user's settings if available
      if (otherParticipantId) {
        try {
          otherUserSettings = await getOtherUserAutoDeleteSettings(otherParticipantId);
          if (otherUserSettings) {
            otherUserMs = getAutoDeleteMilliseconds(otherUserSettings);
          }
        } catch (error) {
          console.error('Error fetching other user auto-delete settings:', error);
        }
      }
      
      // Build the auto-delete info object
      const info: AutoDeleteInfo = {
        userInfo: {
          enabled: Boolean(currentUserMs),
          timeDisplay: ''
        },
        otherUserInfo: otherUserSettings ? {
          enabled: Boolean(otherUserMs),
          timeDisplay: ''
        } : null
      };
      
      // Format time displays
      if (currentUserMs) {
        info.userInfo.timeDisplay = formatTimeForDisplay(currentUserMs);
      }
      
      if (otherUserMs) {
        info.otherUserInfo!.timeDisplay = formatTimeForDisplay(otherUserMs);
      }
      
      setAutoDeleteInfo(info);
    };
    
    fetchAutoDeleteSettings();
    
    // Subscribe to profile changes to get real-time updates for auto-delete settings
    let profileSubscription: any = null;
    
    if (threadDetails && user) {
      const otherParticipantId = threadDetails.participant_ids.find(id => id !== user.id);
      if (otherParticipantId) {
        // Subscribe to the other user's profile changes
        profileSubscription = supabase
          .channel('profile-changes')
          .on('postgres_changes', 
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'profiles',
              filter: `id=eq.${otherParticipantId}`
            }, 
            (payload) => {
              console.log('Detected profile update, refreshing auto-delete settings');
              fetchAutoDeleteSettings();
            }
          )
          .subscribe();
      }
    }
    
    // Refresh auto-delete settings every 60 seconds as a fallback
    const intervalId = setInterval(fetchAutoDeleteSettings, 60000);
    
    return () => {
      clearInterval(intervalId);
      if (profileSubscription) {
        profileSubscription.unsubscribe();
      }
    };
  }, [threadDetails, user]);

  // Also subscribe to our own profile changes in case we update settings in another tab/window
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to the current user's profile changes
    const currentUserSubscription = supabase
      .channel('my-profile-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Local profile updated, refreshing settings display');
          // Get updated settings from localStorage (which should be updated in Settings.tsx)
          const currentUserSettings = getAutoDeleteSettings();
          const currentUserMs = getAutoDeleteMilliseconds(currentUserSettings);
          
          if (autoDeleteInfo) {
            setAutoDeleteInfo(prev => {
              if (!prev) return prev;
              
              const updatedInfo = { ...prev };
              updatedInfo.userInfo.enabled = Boolean(currentUserMs);
              if (currentUserMs) {
                updatedInfo.userInfo.timeDisplay = formatTimeForDisplay(currentUserMs);
              }
              return updatedInfo;
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      if (currentUserSubscription) {
        currentUserSubscription.unsubscribe();
      }
    };
  }, [user, autoDeleteInfo]);
  
  // Helper function to format time in milliseconds to human-readable form
  const formatTimeForDisplay = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hours`;
    } else if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)} days`;
    } else {
      return `${Math.floor(seconds / 604800)} weeks`;
    }
  };

  // Add a useEffect to update the user's last_active status periodically
  useEffect(() => {
    if (!user) return;

    // Update last active now when user first enters the chat
    updateLastActive(user.id);
    
    // Then update every 5 minutes while they're in the chat
    const intervalId = setInterval(() => {
      updateLastActive(user.id);
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      clearInterval(intervalId);
      // Also update when leaving the chat
      updateLastActive(user.id);
    };
  }, [user]);

  // Wrap handleRefreshMessages in useCallback to avoid dependency issues
  const handleRefreshMessages = React.useCallback(async () => {
    if (!threadId || !user) return;
    
    setIsRefreshing(true);
    setLoading(true);
    
    try {
      console.log(`Manually refreshing messages for thread ${threadId}`);
      // Clear current messages first
      setMessages([]);
      
      // Check for expired messages
      try {
        const deletedCount = await checkAndDeleteExpiredMessages(user.id);
        if (deletedCount > 0) {
          console.log(`Auto-deleted ${deletedCount} expired messages during manual refresh`);
        }
      } catch (error) {
        console.error('Error checking for expired messages during refresh:', error);
      }
      
      // Fetch fresh messages
      const messages = await getThreadMessages(threadId);
      setMessages(messages.reverse()); // Reverse to show oldest first
      
      // Clear any unread counter for this thread
      clearUnread();
      
      // Mark unread messages as read
      const unreadMessages = messages.filter(msg => !msg.read && msg.sender_id !== user.id);
      console.log(`Marking ${unreadMessages.length} messages as read during manual refresh`);
      
      if (unreadMessages.length > 0) {
        await Promise.all(unreadMessages.map(async (message) => {
          try {
            await markMessageAsRead(message.id, user.id);
          } catch (error) {
            console.error(`Error marking message ${message.id} as read:`, error);
          }
        }));
      }
      
      console.log('Messages refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh messages:', error);
      setError('Failed to refresh messages. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [threadId, user, clearUnread]);

  // Handle sending a message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !user || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      setError(null);

      // Get the other participant's ID
      const otherParticipantId = threadDetails?.participant_ids.find(id => id !== user.id);
      if (!otherParticipantId) {
        throw new Error('Could not find other participant');
      }

      // Encrypt message if encryption is enabled
      const finalContent = encryptForRecipient 
        ? await encryptForRecipient(newMessage, otherParticipantId)
        : newMessage;

      await sendMessage(threadId, user.id, finalContent);
      
      // Update last active status after sending a message
      updateLastActive(user.id);
      
      setNewMessage('');
    } catch (error) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Listen for custom notification state changes
  useEffect(() => {
    const handleNotificationStateChange = (event: any) => {
      console.log('Notification state change detected in Chat component:', event.detail);
      
      // Check if we need to refresh messages
      if (threadId && user && !loading) {
        console.log('Refreshing messages due to notification state change event');
        handleRefreshMessages();
      }
    };
    
    // Add listener for our custom event
    window.addEventListener('notificationStateChange', handleNotificationStateChange);
    
    return () => {
      window.removeEventListener('notificationStateChange', handleNotificationStateChange);
    };
  }, [threadId, user, loading, handleRefreshMessages]);
  
  // Add a useEffect to watch for changes in notificationsEnabled state
  useEffect(() => {
    console.log('Notification state changed, checking if we need to refresh messages');
    
    // If we have a thread ID and user, and we're not already loading messages
    if (threadId && user && !loading) {
      console.log('Notification setting changed to:', notificationsEnabled);
      // Force refresh messages when notification state changes
      handleRefreshMessages();
    }
  }, [notificationsEnabled]);
  
  // Add an effect to capture localStorage changes that might affect messages
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'xrpchat_notifications_enabled' || 
          event.key === 'xrpchat_notification_permission' ||
          event.key === 'xrpchat_notification_user_choice') {
        console.log('Notification settings changed in localStorage, checking messages');
        
        // If we have a thread ID and user, and we're not already loading messages
        if (threadId && user && !loading) {
          console.log('Refreshing messages after notification settings change in localStorage');
          handleRefreshMessages();
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [threadId, user, loading]);

  if (loading || !threadDetails) {
    return (
      <div className="h-full flex items-center justify-center bg-[#efeae2]">
        <div className="text-center">
          <div className="text-gray-600 mb-2">Loading messages...</div>
          {error && (
            <div className="text-sm text-red-600 max-w-md mx-auto">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#efeae2] dark:bg-gray-900 relative">
      {/* Chat Header */}
      <div className="sticky top-0 bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-20">
        <div className="flex items-center space-x-3">
          <Avatar 
            url={participants[threadDetails.participant_ids.find(id => id !== user?.id) || '']?.avatar_url} 
            size={40}
            className="bg-white/30"
          />
          <div>
            <div className="font-semibold">
              {participants[threadDetails.participant_ids.find(id => id !== user?.id) || '']?.username ? 
                `Chat with ${participants[threadDetails.participant_ids.find(id => id !== user?.id) || '']?.username}` : 
                'Chat'}
            </div>
            <div className="text-xs text-white/80">
              {(() => {
                const participantId = threadDetails.participant_ids.find(id => id !== user?.id) || '';
                const lastActive = participants[participantId]?.last_active;
                if (!lastActive) return 'Never active';
                
                const date = new Date(lastActive);
                const now = new Date();
                const diff = now.getTime() - date.getTime();
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                if (days === 0) {
                  return `Last active today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                } else if (days === 1) {
                  return `Last active yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                } else if (days < 7) {
                  return `Last active ${date.toLocaleDateString([], { weekday: 'long' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                } else {
                  return `Last active ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
              })()}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefreshMessages}
            disabled={isRefreshing || loading}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh messages"
            title="Refresh messages"
          >
            <HiRefresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/app')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Close chat"
          >
            <HiX size={24} />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Debug Logs */}
          {debugMode && debugLogs.map((log, index) => (
            <div key={`debug-${index}`} className="flex items-end space-x-2">
              <div className="max-w-lg px-4 py-2 rounded-lg shadow bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Debug Console</p>
                  <p className="text-sm font-mono whitespace-pre-wrap break-words">{log}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Chat Messages */}
          {messages.map((message, index) => {
            const isUserMessage = message.sender_id === user?.id;
            return (
              <div
                key={`${message.id}-${index}`}
                className={`flex items-end ${isUserMessage ? 'justify-end' : 'justify-start'}`}
              >
                {!isUserMessage ? (
                  <>
                    <Avatar 
                      url={participants[message.sender_id]?.avatar_url}
                      size={32}
                      className="flex-shrink-0 mr-2"
                    />
                    <div>
                      <div
                        className="max-w-lg px-4 py-2 rounded-lg shadow bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {participants[message.sender_id]?.username}
                        </p>
                        <MessageContent 
                          content={message.content}
                          showEncrypted={showEncrypted}
                        />
                        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div
                        className="max-w-lg px-4 py-2 rounded-lg shadow bg-[#dcf8c6] dark:bg-brand-secondary text-gray-800 dark:text-white rounded-br-none"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          You
                        </p>
                        <MessageContent 
                          content={message.content}
                          showEncrypted={showEncrypted}
                        />
                        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <Avatar 
                      url={participants[user?.id || '']?.avatar_url}
                      size={32}
                      className="flex-shrink-0 ml-2"
                    />
                  </>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-[#f0f2f5] dark:bg-gray-800 p-4">
        {error && (
          <div className="mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {autoDeleteInfo && (
          <div className="mb-3 text-xs rounded-md overflow-hidden border dark:border-gray-700">
            <div className={`py-2 px-3 flex items-center justify-between ${
              autoDeleteInfo.userInfo.enabled 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              <div className="flex items-center">
                <HiClock className={`mr-1 ${autoDeleteInfo.userInfo.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} size={14} />
                <span className="font-medium">
                  {autoDeleteInfo.userInfo.enabled 
                    ? `Your messages will auto-delete after ${autoDeleteInfo.userInfo.timeDisplay}` 
                    : 'You have not enabled auto-delete for your messages'}
                </span>
              </div>
              <div className="ml-2">
                <button 
                  onClick={() => navigate('/app/settings')}
                  className={`text-xs underline ${autoDeleteInfo.userInfo.enabled ? 'text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200' : 'text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200'}`}
                  title="Change auto-delete settings"
                >
                  Change
                </button>
              </div>
            </div>
            
            {autoDeleteInfo.otherUserInfo !== null ? (
              <div className={`py-2 px-3 flex items-center border-t dark:border-gray-700 ${
                autoDeleteInfo.otherUserInfo.enabled 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                <HiClock className={`mr-1 ${autoDeleteInfo.otherUserInfo.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} size={14} />
                <span>
                  {(() => {
                    // Get the other participant's username
                    const otherParticipantId = threadDetails.participant_ids.find(id => id !== user?.id) || '';
                    const username = participants[otherParticipantId]?.username || 'Contact';
                    
                    return autoDeleteInfo.otherUserInfo.enabled 
                      ? `${username}'s messages will auto-delete after ${autoDeleteInfo.otherUserInfo.timeDisplay}` 
                      : `${username} has not enabled auto-delete for their messages`;
                  })()}
                </span>
              </div>
            ) : (
              <div className="py-2 px-3 flex items-center border-t dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300">
                <HiClock className="mr-1 text-gray-500 dark:text-gray-400" size={14} />
                <span>
                  {(() => {
                    // Get the other participant's username
                    const otherParticipantId = threadDetails.participant_ids.find(id => id !== user?.id) || '';
                    const username = participants[otherParticipantId]?.username || 'Contact';
                    
                    return `${username} has not configured auto-delete settings`;
                  })()}
                </span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 py-2 px-4 bg-white dark:bg-gray-700 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary border-none placeholder-gray-400 dark:placeholder-gray-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className={`p-2 rounded-full bg-brand-primary text-white hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary ${
              (sending || !newMessage.trim()) && 'opacity-50 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <span className="px-2">...</span>
            ) : (
              <HiPaperAirplane className="w-5 h-5 transform rotate-90" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
