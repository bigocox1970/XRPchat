import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useEncryption } from '../context/EncryptionContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useDebugMode } from '../context/DebugModeContext';
import { supabase, getThreadMessages, sendMessage, markMessageAsRead, subscribeToThread, getProfile, updateLastActive } from '../utils/supabase/index';
import { HiX, HiPaperAirplane, HiClock, HiRefresh, HiArrowLeft, HiDotsHorizontal, HiMicrophone, HiPaperClip, HiTrash } from 'react-icons/hi';
import { DiceBearAvatar } from './DiceBearAvatar';
import type { Database } from '../types/supabase';
import { 
  checkAndDeleteExpiredMessages, 
  getAutoDeleteSettings, 
  getAutoDeleteMilliseconds,
  getOtherUserAutoDeleteSettings
} from '../utils/supabase/autoDelete';
import { IoMdSend, IoMdRefresh } from 'react-icons/io';
import { BsTrash } from 'react-icons/bs';
import { IoLockClosed, IoLockOpen, IoShieldCheckmark } from 'react-icons/io5';
import { PINEntryModal } from './PINEntryModal';
import { EncryptionIndicator } from './EncryptionIndicator';
import { isPrivateKeyAvailable } from '../utils/privateKeyHelpers';
import { uploadChatImage } from '../utils/supabase/storage';

type Message = Database['public']['Tables']['messages']['Row'];

interface ThreadDetails {
  name: string;
  participant_ids: string[];
}

interface ParticipantProfile {
  username: string;
  avatar_url: string | null;
  last_active: string | null;
  avatar_seed?: string | null;
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
  isFromCurrentUser: boolean;
}> = ({ content, showEncrypted, isFromCurrentUser }) => {
  const { decryptMessage } = useEncryption();
  const [decryptedContent, setDecryptedContent] = useState<string>(content);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptionFailed, setDecryptionFailed] = useState(false);
  
  // Check on each render if private key is available
  const privateKeyAvailable = isPrivateKeyAvailable();
  
  // Effect to handle decryption when component mounts or content changes
  // Make sure it runs whenever privateKeyAvailable changes
  useEffect(() => {
    // Reset state when content changes
    setDecryptionFailed(false);
    
    // Always show encrypted content if explicitly requested via showEncrypted
    if (showEncrypted) {
      setDecryptedContent(content);
      setIsDecrypted(false);
      return;
    }
    
    // If private key is not available, show appropriate message
    if (!privateKeyAvailable) {
      setDecryptedContent(`🔒 Private key not available. Restore it in Profile → PIN Security.\n\nEncrypted message:\n${content}`);
      setIsDecrypted(false);
      return;
    }
    
    // If we have the private key and aren't in showEncrypted mode, try to decrypt
    decryptContent();
  }, [content, showEncrypted, privateKeyAvailable]);
  
  // Also listen for storage changes to re-decrypt when private key becomes available
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'xrpchat_private_key_available' && e.newValue === 'true') {
        if (!showEncrypted) {
          decryptContent();
        }
      }
    };
    
    const handleKeyRestored = () => {
      if (!showEncrypted) {
        // Add a small delay to ensure key is fully available
        setTimeout(() => {
          decryptContent();
        }, 100);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('privateKeyRestored', handleKeyRestored);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('privateKeyRestored', handleKeyRestored);
    };
  }, [showEncrypted]);

  const decryptContent = async () => {
    try {
      // First check if message is actually encrypted (looks like base64)
      if (!/^[A-Za-z0-9+/=]+$/.test(content)) {
        // Not encrypted, just show as is
        setDecryptedContent(content);
        setIsDecrypted(true);
        return;
      }
      
      // Attempt decryption
      console.log('Attempting to decrypt message...');
      const decrypted = await decryptMessage(content);
      setDecryptedContent(decrypted);
      setIsDecrypted(true);
      setDecryptionFailed(false);
    } catch (error) {
      console.log('Decryption error:', error instanceof Error ? error.message : 'Unknown error');
      
      // If decryption fails, show the encrypted message with an explanatory note
      setDecryptionFailed(true);
      
      // Different messages based on error type
      if (error instanceof Error && error.message.includes('PIN required')) {
        setDecryptedContent(`🔒 Enter PIN in Profile → Settings to decrypt.\n\nEncrypted message:\n${content}`);
      } else {
        setDecryptedContent(`⚠️ Could not decrypt this message. It may be encrypted for someone else.\n\nEncrypted form:\n${content}`);
      }
    }
  };

  return (
    <div className="whitespace-pre-wrap break-words">
      {decryptedContent}
    </div>
  );
};

export const Chat: React.FC = () => {
  const { id: threadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { 
    notificationsEnabled, 
    requestNotificationPermission, 
    unlockAudio,
    showNotification,
    incrementUnread,
    clearUnread
  } = useNotification();
  const { encryptForRecipient, decryptMessage } = useEncryption();
  const { debugMode } = useDebugMode();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const [participants, setParticipants] = useState<ThreadParticipants>({});
  const { showEncrypted } = useEncryptionMode();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [autoDeleteInfo, setAutoDeleteInfo] = useState<AutoDeleteInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isPrivateKeyDeleted, setIsPrivateKeyDeleted] = useState(
    localStorage.getItem('xrpchat_private_key_available') === 'false'
  );
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [liveTypingEnabled, setLiveTypingEnabled] = useState(
    localStorage.getItem('xrpchat_feature_live_typing') === 'true'
  );
  const [otherUserTypingText, setOtherUserTypingText] = useState('');
  // Image sending feature toggle
  const [imageFeatureEnabled, setImageFeatureEnabled] = useState(
    localStorage.getItem('xrpchat_feature_image_files') === 'true'
  );
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Capture console output in debug mode
  useEffect(() => {
    if (!debugMode) return;

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setDebugLogs((prev: string[]) => [...prev, `[LOG] ${message}`]);
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setDebugLogs((prev: string[]) => [...prev, `[ERROR] ${message}`]);
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  }, [debugMode]);
  
  const inputRef = useRef<HTMLInputElement>(null);

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
      
      // Check private key availability - this will be used by MessageContent components
      const isKeyAvailable = localStorage.getItem('xrpchat_private_key_available') !== 'false';
      console.log(`Private key availability during refresh: ${isKeyAvailable ? 'Available' : 'Not available'}`);
      
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
              last_active: profile.last_active || new Date().toISOString(),
              avatar_seed: profile.avatar_seed
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
    
    // Refresh participant profiles when the component mounts or the thread changes
    if (threadId && user) {
      const refreshParticipantProfiles = async () => {
        if (!threadDetails) return;
        
        try {
          console.log('Refreshing participant profiles on component mount/update');
          
          const profiles = await Promise.all(
            threadDetails.participant_ids.map(async (id: string) => {
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
              last_active: profile.last_active || new Date().toISOString(),
              avatar_seed: profile.avatar_seed
            };
            return acc;
          }, {} as ThreadParticipants);

          setParticipants(participantMap);
        } catch (error) {
          console.error('Error refreshing participant profiles:', error);
        }
      };
      
      refreshParticipantProfiles();
    }
  }, [threadId, user, threadDetails, location.pathname]);

  // Subscribe to profile changes to update avatars in real-time
  useEffect(() => {
    if (!user || !threadDetails) return;
    
    // Create subscriptions for all participants to update their avatars in real-time
    const subscriptions = threadDetails.participant_ids.map(participantId => {
      return supabase
        .channel(`profile-avatar-${participantId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: `id=eq.${participantId}`
          }, 
          async (payload) => {
            console.log(`Profile updated for participant ${participantId}, refreshing avatar`);
            
            try {
              // Fetch the updated profile
              const updatedProfile = await getProfile(participantId);
              
              // Check if the avatar_url or avatar_seed has actually changed before updating state
              // to prevent infinite loops
              const currentParticipant = participants[participantId];
              if (currentParticipant && 
                  (currentParticipant.avatar_url !== updatedProfile.avatar_url || 
                   currentParticipant.avatar_seed !== updatedProfile.avatar_seed)) {
                
                console.log(`Avatar changed for ${participantId}, updating state`);
                
                // Update the participants state with the new avatar and seed
                setParticipants(prev => ({
                  ...prev,
                  [participantId]: {
                    ...prev[participantId],
                    avatar_url: updatedProfile.avatar_url,
                    avatar_seed: updatedProfile.avatar_seed
                  }
                }));
              } else {
                console.log(`No avatar change detected for ${participantId}, checking if this is a message-triggered update`);
                
                // If the updatedProfile has a more recent updated_at timestamp but no avatar changes,
                // this might be our send-message triggered profile update - refresh messages
                if (participantId !== user.id && payload.new?.updated_at) {
                  const newTimestamp = new Date(payload.new.updated_at).getTime();
                  const oldTimestamp = payload.old?.updated_at 
                    ? new Date(payload.old.updated_at).getTime() 
                    : 0;
                  
                  if (newTimestamp > oldTimestamp) {
                    console.log('Profile update with new timestamp detected, checking for new messages');
                    
                    // Instead of a full refresh, fetch only the most recent message
                    try {
                      const { data: latestMessages, error } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('thread_id', threadId)
                        .order('created_at', { ascending: false })
                        .limit(1);
                      
                      if (error) {
                        console.error('Error fetching latest message:', error);
                        return;
                      }
                      
                      if (latestMessages && latestMessages.length > 0) {
                        const latestMessage = latestMessages[0];
                        
                        // Check if this message is already in our state
                        setMessages(prev => {
                          // If message already exists, no need to add it
                          if (prev.some(m => m.id === latestMessage.id)) {
                            return prev;
                          }
                          
                          console.log('Adding new message to chat');
                          // Add the new message and sort
                          const updatedMessages = [...prev, latestMessage].sort(
                            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                          );
                          
                          // Scroll to bottom after adding the message
                          setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                          
                          return updatedMessages;
                        });
                        
                        // Mark message as read if it's not from the current user
                        if (latestMessage.sender_id !== user.id && document.hasFocus()) {
                          try {
                            await markMessageAsRead(latestMessage.id, user.id);
                          } catch (error) {
                            console.error(`Error marking new message ${latestMessage.id} as read:`, error);
                          }
                        }
                      }
                    } catch (error) {
                      console.error('Error handling message refresh:', error);
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error updating participant avatar:', error);
            }
          }
        )
        .subscribe();
    });
    
    // Clean up subscriptions
    return () => {
      subscriptions.forEach(subscription => {
        subscription.unsubscribe();
      });
    };
  }, [user, threadDetails, participants, threadId, messagesEndRef]);

  // Load messages and handle subscriptions
  useEffect(() => {
    if (!threadId || !user) return;
    setMessages([]); // Optionally clear messages only when thread changes

    // Define loadMessages inside the effect
    const loadMessages = async () => {
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
        clearUnread();
        const unreadMessages = messages.filter(msg => !msg.read && msg.sender_id !== user.id);
        console.log(`Marking ${unreadMessages.length} messages as read in thread ${threadId}`);
        if (unreadMessages.length > 0) {
          await Promise.all(unreadMessages.map(async (message) => {
            try {
              await markMessageAsRead(message.id, user.id);
            } catch (error) {
              console.error(`Error marking message ${message.id} as read:`, error);
            }
          }));
        }
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

    loadMessages();

    // Subscribe to new messages
    const unsubscribe = subscribeToThread(
      threadId,
      async (payload) => {
        if (payload.new && user) {
          const message = payload.new;
          if (message.sender_id !== user.id && document.hasFocus()) {
            try {
              await markMessageAsRead(message.id, user.id);
            } catch (error) {}
          }
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
    return () => { unsubscribe(); };
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

  // Handle sending a message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !user || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      setError(null);
      console.log('Starting message send process...');

      // Unlock audio using this user interaction
      try {
        await unlockAudio();
        console.log('Audio unlocked during message send');
      } catch (audioError) {
        console.error('Non-critical error unlocking audio:', audioError);
        // Continue with sending even if audio unlock fails
      }

      // Check if Notification API is available before trying to use it
      if (typeof Notification !== 'undefined') {
        // Try to request notification permission during user interaction
        if (Notification.permission !== 'granted') {
          console.log('Attempting to request notification permission during send');
          try {
            // Request directly with the Notification API
            const permission = await Notification.requestPermission();
            console.log('Notification permission result:', permission);
            
            // Store the result in localStorage
            localStorage.setItem('xrpchat_notification_requested', 'true');
            localStorage.setItem('xrpchat_notification_user_choice', 'true');
            localStorage.setItem('xrpchat_notification_permission', permission);
            
            // Emit event for other components
            window.dispatchEvent(new CustomEvent('notificationStateChange', {
              detail: { permission }
            }));
          } catch (notifError) {
            console.error('Error requesting notification permission during send:', notifError);
          }
        }
      } else {
        console.log('Notification API not available on this device');
      }

      // Get the other participant's ID
      const otherParticipantId = threadDetails?.participant_ids.find(id => id !== user.id);
      if (!otherParticipantId) {
        console.error('Could not find other participant in thread');
        throw new Error('Could not find other participant');
      }

      // Log the encryption process
      console.log('Preparing to encrypt/send message...');
      
      // Encrypt message if encryption is enabled
      let finalContent;
      try {
        finalContent = encryptForRecipient 
          ? await encryptForRecipient(newMessage, otherParticipantId)
          : newMessage;
        console.log('Message prepared successfully');
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
        throw new Error('Failed to encrypt message');
      }
      
      // Send the message
      try {
        console.log('Sending message to Supabase...');
        await sendMessage(threadId, user.id, finalContent);
        console.log('Message sent successfully');
        getThreadMessages(threadId).then(messages => {
          setMessages(messages.reverse()); // Reverse to show oldest first
        });
        // Scroll to bottom after a short delay
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } catch (sendError) {
        console.error('Error sending message to database:', sendError);
        throw new Error('Network error while sending message');
      }
      
      // Set a flag in localStorage to tell the notification system that the last message 
      // was sent by us, to ensure we don't play sounds for our own messages
      localStorage.setItem('xrpchat_last_message_sender', user.id);
      
      // Update last active status after sending a message
      try {
        await updateLastActive(user.id);
      } catch (activeError) {
        console.error('Non-critical error updating last active status:', activeError);
        // Continue since this is non-critical
      }
      
      // Additionally, update the user's profile to trigger a real-time update for the other user
      // This is similar to how avatar regeneration works and will cause the chat to refresh
      // for the other user immediately, showing the new message
      if (user.id) {
        try {
          // Update the profile with the current timestamp to trigger a real-time update
          await supabase
            .from('profiles')
            .update({ 
              updated_at: new Date().toISOString() 
            })
            .eq('id', user.id);
            
          console.log('Profile updated to trigger real-time refresh for other users');
        } catch (profileUpdateError) {
          console.error('Non-critical error updating profile for real-time refresh:', profileUpdateError);
          // Don't throw here as the message was sent successfully
        }
      }
      
      setNewMessage('');
      console.log('Message send process completed successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show a more detailed error message based on error type
      if (error instanceof Error) {
        setError(`Failed to send message: ${error.message}`);
      } else {
        setError('Failed to send message. Please check your connection and try again.');
      }
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

  // Check for private key status changes
  useEffect(() => {
    const checkKeyAvailability = () => {
      setIsPrivateKeyDeleted(localStorage.getItem('xrpchat_private_key_available') === 'false');
    };
    
    checkKeyAvailability();
    
    // Listen for changes to localStorage
    window.addEventListener('storage', checkKeyAvailability);
    
    return () => {
      window.removeEventListener('storage', checkKeyAvailability);
    };
  }, []);

  // Add effect to listen for private key restoration
  useEffect(() => {
    const handlePrivateKeyRestored = () => {
      console.log("Private key has been restored, refreshing messages");
      setIsPrivateKeyDeleted(false);
      // Force refresh messages to ensure they're decrypted with the restored key
      handleRefreshMessages();
    };
    
    window.addEventListener('privateKeyRestored', handlePrivateKeyRestored);
    
    // Also listen for localStorage changes directly
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'xrpchat_private_key_available' && e.newValue === 'true') {
        console.log("Private key availability changed via localStorage, refreshing messages");
        handleRefreshMessages();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('privateKeyRestored', handlePrivateKeyRestored);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleRefreshMessages]);

  useEffect(() => {
    if (!threadId || !user) return;

    const channel = supabase
      .channel(`typing-${threadId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Only show if it's from the other user
        if (payload.payload.userId !== user.id) {
          setOtherUserTyping(true);
          setOtherUserTypingText(payload.payload.text || '');
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setOtherUserTyping(false);
            setOtherUserTypingText('');
          }, 2000);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [threadId, user]);

  // Listen for changes to the toggle (e.g., if user changes it in another tab)
  useEffect(() => {
    const handleStorage = () => {
      setLiveTypingEnabled(localStorage.getItem('xrpchat_feature_live_typing') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Listen for storage changes to update image feature toggle
  useEffect(() => {
    const handleStorage = () => {
      setImageFeatureEnabled(localStorage.getItem('xrpchat_feature_image_files') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageUploadError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError('Image size should be less than 5MB');
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Handle sending image message
  const handleSendImage = async () => {
    if (!selectedImage || !threadId || !user) return;
    setUploadingImage(true);
    setImageUploadError(null);
    try {
      // Debug log file info
      console.log('Uploading file:', {
        name: selectedImage.name,
        type: selectedImage.type,
        size: selectedImage.size,
        instance: selectedImage instanceof File,
        isBlob: selectedImage instanceof Blob
      });
      // Only upload the raw File object
      const imageUrl = await uploadChatImage(selectedImage, threadId, user.id);
      // Send as image message
      await sendMessage(threadId, user.id, imageUrl, 'image');
      setSelectedImage(null);
      setImagePreview(null);
      getThreadMessages(threadId).then(messages => {
        setMessages(messages.reverse());
      });
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    let lastHidden = Date.now();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHidden = Date.now();
      } else if (document.visibilityState === 'visible') {
        // If hidden for more than 10 minutes, reload
        if (Date.now() - lastHidden > 10 * 60 * 1000) {
          window.location.reload();
        } else {
          handleRefreshMessages();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefreshMessages]);

  useEffect(() => {
    if (loading || !threadDetails) {
      const timeout = setTimeout(() => setLoadingTimeout(true), 15000); // 15 seconds
      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading, threadDetails]);

  const handleDeleteMessage = (messageId: string) => {
    setDeletingMessageId(messageId);
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setDeletingMessageId(null);
    }, 600); // match explosion duration
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-[#efeae2]">
        <div className="text-center text-red-600">User not loaded. Please sign in again or refresh the page.</div>
      </div>
    );
  }

  // Debug log for user id and message sender ids
  console.log('Current user id:', user?.id);
  messages.forEach(m => console.log('Message', m.id, 'sender:', m.sender_id));

  if (loading || !threadDetails) {
    return (
      <div className="h-full flex items-center justify-center bg-[#efeae2]">
        <div className="text-center">
          <div className="text-gray-600 mb-2">Loading messages...</div>
          <button
            className={`mt-2 text-blue-700 text-sm flex items-center justify-center mx-auto transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
            onClick={() => { setIsRefreshing(true); window.location.reload(); }}
            style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <HiRefresh className="w-5 h-5 mr-1" />
            <span>Reload</span>
          </button>
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
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 natural-light:bg-natural-background natural-dark:bg-natural-dark-background">
      {/* Chat Header */}
      <div className="bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-full">
            <DiceBearAvatar 
              url={participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.avatar_url} 
              size={40} 
              userId={threadDetails?.participant_ids.find(id => id !== user?.id) || ''} 
              seed={participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.avatar_seed || undefined}
              key={`chat-header-avatar-${participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.avatar_url}-${participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.avatar_seed || ''}`}
            />
          </div>
          <div className="overflow-hidden">
            <div className="font-semibold truncate">{participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.username || 'Unknown User'}</div>
            <div className="text-xs text-white/80 truncate">
              {(() => {
                const participantId = threadDetails?.participant_ids.find(id => id !== user?.id) || '';
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
        <div className="flex items-center space-x-3">
          <EncryptionIndicator />
          <button
            onClick={() => window.location.reload()}
            disabled={isRefreshing || loading}
            className="p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors"
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

      {/* Private Key Deleted Notice */}
      {isPrivateKeyDeleted && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-900 px-4 py-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-medium">Private key unavailable:</span> Messages appear encrypted because your private key has been deleted from this device. This demonstrates true end-to-end encryption - without the key, messages are unreadable.
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-2">
                <span className="font-medium">Why do both sides of the conversation look encrypted?</span> Each message is individually encrypted and stored in the database until it's auto-deleted. No raw messages or private keys are ever sent to the server. The actual private key never leaves your device.
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                <span className="font-medium">To restore access:</span> Go to Profile → PIN Security Settings and use the "Restore from PIN" button.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main chat content */}
      <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col h-full space-y-4 w-full">
          {/* Push content to bottom when few messages */}
          <div className="flex-1 mt-auto">
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
              const isDeleting = deletingMessageId === message.id;
              const isHovered = hoveredMessageId === message.id;
              return (
                <div
                  key={`${message.id}-${index}`}
                  className={`group flex items-end ${isUserMessage ? 'justify-end' : 'justify-start'} mb-4`}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  onFocus={() => setHoveredMessageId(message.id)}
                  onBlur={() => setHoveredMessageId(null)}
                  tabIndex={0}
                >
                  {!isUserMessage ? (
                    <>
                    <DiceBearAvatar 
                      url={participants[message.sender_id]?.avatar_url}
                      size={32}
                      className="flex-shrink-0 mr-2"
                      userId={message.sender_id}
                      seed={participants[message.sender_id]?.avatar_seed || undefined}
                      key={`chat-message-other-avatar-${message.id}-${participants[message.sender_id]?.avatar_url}-${participants[message.sender_id]?.avatar_seed || ''}`}
                    />
                      <div className="max-w-[75%] relative">
                        <div
                          className={`px-4 py-2 rounded-lg shadow bg-white dark:bg-gray-700 natural-dark:bg-[#F5EEE0] text-gray-800 dark:text-white natural-dark:text-gray-800 rounded-bl-none transition-transform duration-500 ${isDeleting ? 'explode-out' : ''}`}
                        >
                          {/* Explosion overlay */}
                          {isDeleting && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                              <span className="text-3xl animate-explode">💥</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {participants[message.sender_id]?.username}
                          </p>
                          {message.type === 'image' ? (
                            <img
                              src={message.content}
                              alt="Sent image"
                              className="max-w-xs max-h-64 rounded border my-2"
                              onError={e => { (e.target as HTMLImageElement).src = '/img/image-placeholder.png'; }}
                            />
                          ) : (
                            <MessageContent
                              content={message.content}
                              showEncrypted={showEncrypted}
                              isFromCurrentUser={isUserMessage}
                            />
                          )}
                          <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {/* Trash icon for deleting message (all messages) */}
                          <button
                            className={`absolute top-1 right-1 text-gray-400 hover:text-red-600 p-1 bg-white/70 rounded-full z-10 transition-opacity duration-200 chat-trash-btn`}
                            style={{ display: isDeleting ? 'none' : 'block' }}
                            onClick={() => handleDeleteMessage(message.id)}
                            tabIndex={-1}
                            aria-label="Delete message"
                          >
                            <HiTrash size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="max-w-[75%] relative">
                        <div
                          className={`px-4 py-2 rounded-lg shadow bg-[#dcf8c6] dark:bg-brand-secondary natural-dark:bg-[#D2BC9B] text-gray-800 dark:text-white natural-dark:text-gray-800 rounded-br-none transition-transform duration-500 ${isDeleting ? 'explode-out' : ''}`}
                        >
                          {/* Explosion overlay */}
                          {isDeleting && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                              <span className="text-3xl animate-explode">💥</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            You
                          </p>
                          <MessageContent 
                            content={message.content}
                            showEncrypted={showEncrypted}
                            isFromCurrentUser={isUserMessage}
                          />
                          <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {/* Trash icon for deleting message (all messages) */}
                          <button
                            className={`absolute top-1 right-1 text-gray-400 hover:text-red-600 p-1 bg-white/70 rounded-full z-10 transition-opacity duration-200 chat-trash-btn`}
                            style={{ display: isDeleting ? 'none' : 'block' }}
                            onClick={() => handleDeleteMessage(message.id)}
                            tabIndex={-1}
                            aria-label="Delete message"
                          >
                            <HiTrash size={16} />
                          </button>
                        </div>
                      </div>
                      <DiceBearAvatar 
                        url={participants[user?.id || '']?.avatar_url}
                        size={32}
                        className="flex-shrink-0 ml-2"
                        userId={user?.id || ''}
                        seed={participants[user?.id || '']?.avatar_seed || undefined}
                        key={`chat-message-avatar-${message.id}-${participants[user?.id || '']?.avatar_url}-${participants[user?.id || '']?.avatar_seed || ''}`}
                      />
                    </>
                  )}
                </div>
              );
            })}
            {otherUserTyping && (
              <div className="flex items-end justify-start mb-4">
                <DiceBearAvatar
                  url={participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.avatar_url}
                  size={32}
                  className="flex-shrink-0 mr-2"
                  userId={threadDetails?.participant_ids.find(id => id !== user?.id) || ''}
                  seed={participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.avatar_seed || undefined}
                />
                <div className="max-w-[75%]">
                  <div className="px-4 py-2 rounded-lg shadow bg-white dark:bg-gray-700 natural-dark:bg-[#F5EEE0] text-gray-800 dark:text-white natural-dark:text-gray-800 rounded-bl-none flex items-center">
                    <span className="italic text-gray-500">
                      {participants[threadDetails?.participant_ids.find(id => id !== user?.id) || '']?.username || "User"} is typing...
                    </span>
                    {liveTypingEnabled && otherUserTypingText && (
                      <span className="ml-2 text-gray-700 dark:text-gray-200">{otherUserTypingText}</span>
                    )}
                    <span className="ml-2 animate-bounce text-lg text-gray-400">...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-6 mb-4" />
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 natural-light:border-natural-border natural-dark:border-natural-dark-border bg-white dark:bg-gray-800 natural-light:bg-natural-paper natural-dark:bg-natural-dark-paper">
        {error && (
          <div className="mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {autoDeleteInfo && (
          <div className="mb-3 text-xs rounded-md overflow-hidden border dark:border-gray-700 natural-light:border-[#A67C52] natural-dark:border-[#8B5A2B]">
            <div className={`py-2 px-3 flex items-center justify-between ${
              autoDeleteInfo.userInfo.enabled 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-white natural-light:!bg-[#A67C52]/50 natural-dark:!bg-[#A67C52] natural-light:!text-[#4A3C31] natural-dark:!text-[#F5EEE0]' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-white natural-light:bg-red-100 natural-dark:bg-red-900/30 natural-light:text-red-800 natural-dark:text-white'
            }`}>
              <div className="flex items-center">
                <HiClock className={`mr-1 ${autoDeleteInfo.userInfo.enabled ? 'text-green-600 dark:text-white natural-light:!text-[#4A3C31] natural-dark:!text-[#F5EEE0]' : 'text-red-600 dark:text-white natural-light:text-red-600 natural-dark:text-white'}`} size={14} />
                <span className="font-medium">
                  {autoDeleteInfo.userInfo.enabled 
                    ? `Your messages will auto-delete after ${autoDeleteInfo.userInfo.timeDisplay}` 
                    : 'You have not enabled auto-delete for your messages'}
                </span>
              </div>
              <div className="ml-2">
                <button 
                  onClick={() => navigate('/app/settings')}
                  className={`text-xs underline ${autoDeleteInfo.userInfo.enabled ? 'text-green-700 dark:text-white natural-light:!text-[#4A3C31] natural-dark:!text-[#F5EEE0] hover:text-green-800 natural-light:hover:!text-black natural-dark:hover:!text-white' : 'text-red-700 dark:text-white hover:text-red-800 dark:hover:text-gray-200 natural-light:text-red-700 natural-dark:text-white natural-light:hover:text-red-800 natural-dark:hover:text-gray-200'}`}
                  title="Change auto-delete settings"
                >
                  Change
                </button>
              </div>
            </div>
            
            {autoDeleteInfo.otherUserInfo !== null ? (
              <div className={`py-2 px-3 flex items-center border-t dark:border-gray-700 natural-light:border-[#A67C52] natural-dark:border-[#8B5A2B] ${
                autoDeleteInfo.otherUserInfo.enabled 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-white natural-light:!bg-[#A67C52]/30 natural-dark:!bg-[#A67C52]/80 natural-light:!text-[#4A3C31] natural-dark:!text-[#F5EEE0]' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-white natural-light:bg-red-50 natural-dark:bg-red-900/20 natural-light:text-red-700 natural-dark:text-white'
              }`}>
                <HiClock className={`mr-1 ${autoDeleteInfo.otherUserInfo.enabled ? 'text-green-600 dark:text-white natural-light:!text-[#4A3C31] natural-dark:!text-[#F5EEE0]' : 'text-red-600 dark:text-white natural-light:text-red-600 natural-dark:text-white'}`} size={14} />
                <span>
                  {(() => {
                    const otherParticipantId = threadDetails?.participant_ids?.find(id => id !== user?.id) || '';
                    const username = participants[otherParticipantId]?.username || 'Contact';
                    
                    return autoDeleteInfo.otherUserInfo.enabled 
                      ? `${username}'s messages will auto-delete after ${autoDeleteInfo.otherUserInfo.timeDisplay}` 
                      : `${username} has not enabled auto-delete for their messages`;
                  })()}
                </span>
              </div>
            ) : (
              <div className="py-2 px-3 flex items-center border-t dark:border-gray-700 natural-light:border-[#A67C52] natural-dark:border-[#8B5A2B] bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300">
                <HiClock className="mr-1 text-gray-500 dark:text-gray-400 natural-light:!text-gray-500 natural-dark:!text-gray-400" size={14} />
                <span>
                  {(() => {
                    const otherParticipantId = threadDetails?.participant_ids?.find(id => id !== user?.id) || '';
                    const username = participants[otherParticipantId]?.username || 'Contact';
                    
                    return `${username} has not configured auto-delete settings`;
                  })()}
                </span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center space-x-2">
          {imageFeatureEnabled && (
            <>
              <label className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center" title="Attach Image">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={uploadingImage}
                />
                <HiPaperClip className="w-5 h-5" />
                <span className="sr-only">Attach Image</span>
              </label>
              <button
                type="button"
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                title="Record Audio"
                onClick={() => alert('Audio message feature coming soon!')}
                disabled={uploadingImage}
              >
                <HiMicrophone className="w-5 h-5" />
                <span className="sr-only">Record Audio</span>
              </button>
            </>
          )}
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              if (user) {
                supabase.channel(`typing-${threadId}`).send({
                  type: 'broadcast',
                  event: 'typing',
                  payload: { userId: user.id, text: e.target.value }
                });
              }
            }}
            placeholder="Type a message..."
            className="flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-full px-4 py-2 focus:ring-brand-primary focus:border-brand-primary dark:focus:ring-blue-500 dark:focus:border-blue-500 natural-light:focus:ring-natural-primary natural-light:focus:border-natural-primary natural-dark:focus:ring-natural-dark-primary natural-dark:focus:border-natural-dark-primary"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="p-2 rounded-full bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white hover:bg-brand-secondary natural-light:hover:bg-natural-secondary natural-dark:hover:bg-natural-dark-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <HiDotsHorizontal size={20} className="animate-pulse" />
            ) : (
              <HiPaperAirplane size={20} className="transform rotate-90" />
            )}
          </button>
        </form>
        {imagePreview && (
          <div className="flex items-center space-x-2 mt-2">
            <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded border" />
            <button
              type="button"
              onClick={() => { setSelectedImage(null); setImagePreview(null); }}
              className="text-xs text-red-600 hover:underline"
            >Remove</button>
            <button
              type="button"
              onClick={handleSendImage}
              disabled={uploadingImage}
              className="ml-2 px-3 py-1 rounded bg-brand-primary text-white disabled:opacity-50"
            >{uploadingImage ? 'Uploading...' : 'Send Image'}</button>
            {imageUploadError && <div className="text-xs text-red-600 ml-2">{imageUploadError}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
