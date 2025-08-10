import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useEncryption } from '../context/EncryptionContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useDebugMode } from '../context/DebugModeContext';
import { useGun } from '../context/GunContext';
import { supabase, getThreadMessages, sendMessage, markMessageAsRead, subscribeToThread, getProfile, updateLastActive } from '../utils/supabase/index';
import { sendHybridMessage } from '../utils/gun/hybrid';
import { gun } from '../utils/gun/client';
import { HiX, HiPaperAirplane, HiClock, HiRefresh, HiArrowLeft, HiDotsHorizontal, HiMicrophone, HiPaperClip, HiTrash, HiCloud } from 'react-icons/hi';
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
  publicKey?: string; // Add public key for Gun.js encryption
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

// Enhanced ErrorBoundary for catching render/runtime errors in Chat
class ErrorBoundary extends React.Component<any, { 
  hasError: boolean; 
  error: any; 
  isConnectionError: boolean;
  retryCount: number;
}> {
  private maxRetries = 3;
  
  constructor(props: any) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      isConnectionError: false,
      retryCount: 0
    };
  }
  
  static getDerivedStateFromError(error: any) {
    const isConnectionError = error?.message?.includes('fetch') || 
                             error?.message?.includes('network') ||
                             error?.message?.includes('WebSocket') ||
                             error?.message?.includes('connection');
    
    return { 
      hasError: true, 
      error,
      isConnectionError
    };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // If it's a connection error, we might want to retry
    if (this.state.isConnectionError && this.state.retryCount < this.maxRetries) {
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          isConnectionError: false,
          retryCount: prev.retryCount + 1
        }));
      }, 2000 * (this.state.retryCount + 1)); // Progressive delay
    }
  }
  
  handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      isConnectionError: false,
      retryCount: 0
    });
  }
  
  render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < this.maxRetries;
      
      return (
        <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="max-w-md mx-auto text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {this.state.isConnectionError ? 'Connection Problem' : 'Something went wrong'}
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {this.state.isConnectionError 
                ? 'Lost connection to the chat server. The app will try to reconnect automatically.'
                : 'An unexpected error occurred in the chat.'
              }
            </p>
            
            {this.state.isConnectionError && (
              <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Retry attempt: {this.state.retryCount + 1} of {this.maxRetries + 1}
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={this.handleManualRetry}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Try Again
              </button>
              
              {/* Reload button removed to prevent refresh issues */}
              
              <button
                onClick={() => window.location.href = '/app'}
                className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Back to Chat List
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer">Error Details</summary>
                <pre className="mt-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-32">
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Chat: React.FC = () => {
  const { id: threadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profileRefreshing } = useUser();
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
  const { 
    isConnected: gunConnected, 
    connectedPeers,
    subscribeToThread: subscribeToGunThread,
    sendMessage: sendGunMessage,
    isAuthenticated: gunAuthenticated,
    currentUser: gunUser
  } = useGun();
  
  // Get enhanced connection status from Gun.js
  const [gunConnectionHealth, setGunConnectionHealth] = useState<any>(null);
  
  useEffect(() => {
    const updateGunHealth = () => {
      try {
        // Import getConnectionHealth dynamically to avoid circular imports
        import('../utils/gun/client').then(({ getConnectionHealth }) => {
          const health = getConnectionHealth();
          setGunConnectionHealth(health);
        });
      } catch (error) {
        console.warn('Could not get Gun.js connection health:', error);
      }
    };
    
    updateGunHealth();
    const interval = setInterval(updateGunHealth, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, []);
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
  // Image sending feature toggle
  const [imageFeatureEnabled, setImageFeatureEnabled] = useState(
    localStorage.getItem('xrpchat_feature_media_files') === 'true'
  );
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);
  
  // Enhanced debug logging for connection and typing feature state
  useEffect(() => {
    const hasRealPeers = gunConnectionHealth?.hasRealPeers || false;
    const connectionType = gunConnectionHealth?.connectionType || 'Unknown';
    
    console.log('🎯 Live typing enabled:', liveTypingEnabled);
    console.log('🎯 Gun connected:', gunConnected);
    console.log('🎯 Gun authenticated:', gunAuthenticated);
    console.log('🎯 Connected peers:', connectedPeers);
    console.log('🎯 Connection type:', connectionType);
    console.log('🎯 Has real relay peers:', hasRealPeers);
    console.log('🎯 Current typing users:', Array.from(typingUsers));
    console.log('🎯 Will use Gun.js for typing:', gunConnected && gunAuthenticated && connectedPeers > 0);
    console.log('🎯 Will use Gun.js for messages:', gunConnected && gunAuthenticated && hasRealPeers);
  }, [liveTypingEnabled, gunConnected, gunAuthenticated, connectedPeers, typingUsers, gunConnectionHealth]);

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
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(64); // Start with two-line height (32px per line)
  const [maxTextareaHeight, setMaxTextareaHeight] = useState(200); // Default max height
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false); // Track if textarea is at max height
  const [isMultiLine, setIsMultiLine] = useState(false); // Track if content spans 3+ lines (for scroll indicator)
  
  // Calculate max textarea height based on screen size (30%)
  useEffect(() => {
    const calculateMaxHeight = () => {
      const screenHeight = window.innerHeight;
      const maxHeight = Math.floor(screenHeight * 0.3); // 30% of screen height
      setMaxTextareaHeight(Math.max(maxHeight, 120)); // Minimum 120px, maximum 30% of screen
    };
    
    calculateMaxHeight();
    window.addEventListener('resize', calculateMaxHeight);
    
    return () => window.removeEventListener('resize', calculateMaxHeight);
  }, []);
  
  // Auto-expand textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      // Reset height to get accurate scrollHeight
      textarea.style.height = '64px'; // Reset to two-line height
      
      // Calculate new height (add padding for better appearance)
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 64), maxTextareaHeight); // Minimum 64px for two lines
      const atMaxHeight = scrollHeight > maxTextareaHeight;
      
      // Check if content spans more than three lines
      const twoLineHeight = 64; // Our default two-line height
      const threeLineHeight = 96; // Approximately three lines (32px per line)
      const hasThreeOrMoreLines = scrollHeight > threeLineHeight; // Show scroll indicator after 3 lines
      
      // Apply new height with smooth transition
      setTextareaHeight(newHeight);
      setIsAtMaxHeight(atMaxHeight);
      setIsMultiLine(hasThreeOrMoreLines); // Now represents "3+ lines" instead of just multi-line
      textarea.style.height = `${newHeight}px`;
      
      // Handle scrolling when content exceeds max height
      if (atMaxHeight) {
        textarea.style.overflowY = 'auto';
        // Scroll to bottom when typing
        textarea.scrollTop = textarea.scrollHeight;
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [maxTextareaHeight]);
  
  // Adjust height when message content changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage, adjustTextareaHeight]);

  // Enhanced refresh with better state management
  const handleRefreshMessages = React.useCallback(async () => {
    if (!threadId || !user || isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    console.log('Starting message refresh...');
    setIsRefreshing(true);
    setLoading(true);
    setError(null); // Clear any existing errors
    
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

  // Enhanced connection monitoring
  useEffect(() => {
    const handleConnectionRefresh = () => {
      console.log('🔄 Received Supabase connection refresh event');
      setIsReconnecting(true);
      
      // Refresh messages after connection restoration
      setTimeout(() => {
        if (threadId && user) {
          console.log('🔄 Refreshing messages after connection restore');
          handleRefreshMessages();
        }
        setIsReconnecting(false);
      }, 1000);
    };
    
    const handleConnectionError = (event: any) => {
      console.error('📶 Supabase connection error:', event.detail);
      setConnectionStatus('error');
      setConnectionError(event.detail.error || 'Connection failed');
    };
    
    window.addEventListener('supabaseConnectionRefresh', handleConnectionRefresh);
    window.addEventListener('supabaseConnectionError', handleConnectionError);
    
    return () => {
      window.removeEventListener('supabaseConnectionRefresh', handleConnectionRefresh);
      window.removeEventListener('supabaseConnectionError', handleConnectionError);
    };
  }, [threadId, user, handleRefreshMessages]);
  
  // Load messages and handle subscriptions
  useEffect(() => {
    if (!threadId || !user) return;
    setMessages([]); // Optionally clear messages only when thread changes
    setConnectionStatus('connecting');
    setConnectionError(null);

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
        setConnectionStatus('error');
        setConnectionError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Subscribe to new messages using Gun.js for real-time updates
    let gunUnsubscribe: (() => void) | null = null;
    let supabaseUnsubscribe: (() => void) | null = null;
    
    const handleMessageReceived = (message: any, source: 'gun' | 'supabase' = 'supabase') => {
      console.log(`📨 Message received via ${source}:`, message.id || message.new?.id);
      setConnectionStatus('connected');
      setConnectionError(null);
      
      // Convert Gun.js message to Supabase format if needed
      const normalizedMessage = source === 'gun' ? {
        id: message.id,
        sender_id: message.sender_id,
        content: message.content,
        created_at: message.created_at,
        type: message.type || 'text',
        read: false,
        thread_id: threadId || ''
      } : message.new;
      
      if (!normalizedMessage) return;
      
      // Remove typing indicator for this sender since they sent a real message
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(normalizedMessage.sender_id);
        return newSet;
      });
      
      // Add the real message
      setMessages(prev => {
        // Only add if not already present
        if (prev.some(m => m.id === normalizedMessage.id)) return prev;
        return [...prev, normalizedMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      
      // Mark as read if not from current user and window is focused
      if (normalizedMessage.sender_id !== user.id && document.hasFocus()) {
        try {
          markMessageAsRead(normalizedMessage.id, user.id).catch(() => {});
        } catch (error) {}
      }
      
      // Auto-scroll to new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };
    
    // Enhanced connection logic: Use Gun.js only if we have real relay peers
    const hasRealPeers = gunConnectionHealth?.hasRealPeers || false;
    const shouldUseGun = gunConnected && gunAuthenticated && hasRealPeers;
    
    if (shouldUseGun) {
      console.log('📡 Using Gun.js P2P for real-time message updates (with relay peers)');
      setConnectionStatus('connected');
      gunUnsubscribe = subscribeToGunThread(
        threadId,
        (gunMessage) => handleMessageReceived(gunMessage, 'gun')
      );
    } else {
      // Always use Supabase if Gun.js doesn't have real relay connections
      const reason = !gunConnected ? 'Gun.js not connected' :
                    !gunAuthenticated ? 'Gun.js not authenticated' :
                    !hasRealPeers ? 'Gun.js has no relay peers (local only)' :
                    'Unknown reason';
      
      console.log(`📡 Using Supabase for real-time message updates (${reason})`);
      supabaseUnsubscribe = subscribeToThread(
        threadId,
        (payload) => {
          handleMessageReceived(payload, 'supabase');
          setConnectionStatus('connected');
        },
        () => {}
      );
    }
    
    // Cleanup function
    return () => { 
      if (gunUnsubscribe) gunUnsubscribe();
      if (supabaseUnsubscribe) supabaseUnsubscribe();
    };
  }, [threadId, user, notificationsEnabled, showNotification, incrementUnread, clearUnread, location.pathname, participants, decryptMessage, showEncrypted, gunConnected, gunAuthenticated, subscribeToGunThread, messagesEndRef]);

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
      
      // Send the message using hybrid approach (Gun.js + Supabase)
      try {
        console.log('Sending message via hybrid approach...');
        
        // Get recipient's public key for Gun.js encryption
        const recipientProfile = participants[otherParticipantId];
        const recipientPublicKey = recipientProfile?.publicKey || 'unknown'; // Will need to get this from Gun.js profile
        
        const hasRealPeers = gunConnectionHealth?.hasRealPeers || false;
        if (gunConnected && gunAuthenticated && hasRealPeers) {
          console.log('📡 Sending via Gun.js hybrid system (with relay peers)...');
          await sendHybridMessage(
            threadId, 
            user.id, 
            gunUser?.publicKey || 'sender_pub_key', // Use Gun.js user's public key
            recipientPublicKey,
            finalContent
          );
        } else {
          const reason = !gunConnected ? 'Gun.js not connected' :
                        !gunAuthenticated ? 'Gun.js not authenticated' :
                        !hasRealPeers ? 'no relay peers (local only)' :
                        'unknown reason';
          console.log(`📡 Fallback to Supabase only (${reason})...`);
          await sendMessage(threadId, user.id, finalContent);
        }
        
        console.log('Message sent successfully');
        
        // Refresh messages to show the new message
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
        console.error('Error sending message:', sendError);
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
      
      // Clear typing indicator when message is sent
      if (user && liveTypingEnabled) {
        if (gunConnected && gunAuthenticated && connectedPeers > 0) {
          const typingKey = `typing_${threadId}`;
          const clearData = {
            isTyping: false,
            timestamp: new Date().toISOString()
          };
          gun.get('typing').get(typingKey).get(user.id).put(clearData);
        } else if (typingChannelRef.current) {
          typingChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: user.id, isTyping: false }
          });
        }
      }
      
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

  // Typing indicator management
  const addTypingUser = useCallback((userId: string) => {
    console.log(`🎯 Adding typing user: ${userId}`);
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      newSet.add(userId);
      console.log(`🎯 Typing users after adding ${userId}:`, Array.from(newSet));
      return newSet;
    });
  }, []);

  const removeTypingUser = useCallback((userId: string) => {
    console.log(`🎯 Removing typing user: ${userId}`);
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      console.log(`🎯 Typing users after removing ${userId}:`, Array.from(newSet));
      return newSet;
    });
  }, []);

  // Listen for typing events
  useEffect(() => {
    if (!threadId || !user) {
      console.log('🎯 Not setting up typing subscription - missing threadId or user');
      return;
    }
    
    console.log('🎯 Setting up typing subscription for thread', threadId, 'user', user.id);
    
    let typingChannel: any = null;
    let gunTypingUnsubscribe: (() => void) | null = null;
    
    // Use Gun.js for typing if connected AND authenticated AND has peers, otherwise fallback to Supabase
    if (gunConnected && gunAuthenticated && connectedPeers > 0) {
      console.log('🔫 Using Gun.js for typing indicators');
      // Gun.js typing implementation using standardized approach
      const typingKey = `typing_${threadId}`;
      console.log(`🔫 Subscribing to Gun.js typing key: ${typingKey}`);
      
      gun.get('typing').get(typingKey).map().on((typingData: any, userId: string) => {
        console.log(`🔫 Received typing data for user ${userId}:`, typingData);
        if (typingData && userId !== '_' && userId !== user.id) {
          const isTyping = typingData.isTyping && (Date.now() - new Date(typingData.timestamp).getTime() < 3000);
          
          console.log(`🔫 Processing typing for ${userId}: isTyping=${isTyping}, current users:`, Array.from(typingUsers));
          
          if (isTyping) {
            console.log(`🔫 ✅ User ${userId} is typing in thread ${threadId}`);
            addTypingUser(userId);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
              console.log(`🔫 ⏰ Auto-removing typing indicator for user ${userId}`);
              removeTypingUser(userId);
            }, 3000);
          } else {
            console.log(`🔫 ❌ User ${userId} stopped typing`);
            removeTypingUser(userId);
          }
        }
      });
      
      gunTypingUnsubscribe = () => {
        console.log(`🔫 Unsubscribing from Gun.js typing for ${typingKey}`);
        gun.get('typing').get(typingKey).off();
      };
    } else {
      console.log('📡 Using Supabase for typing indicators');
      // Supabase fallback for typing
      const channelName = `typing-${threadId}`;
      console.log(`📡 Subscribing to Supabase channel: ${channelName}`);
      
      typingChannel = supabase
        .channel(channelName)
        .on('broadcast', { event: 'typing' }, (payload) => {
          console.log(`📡 Received Supabase typing payload:`, payload);
          if (payload.payload.userId !== user.id) {
            if (payload.payload.isTyping) {
              console.log(`📡 ✅ User ${payload.payload.userId} is typing via Supabase`);
              addTypingUser(payload.payload.userId);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => {
                console.log(`📡 ⏰ Auto-removing typing indicator for user ${payload.payload.userId}`);
                removeTypingUser(payload.payload.userId);
              }, 3000);
            } else {
              console.log(`📡 ❌ User ${payload.payload.userId} stopped typing via Supabase`);
              removeTypingUser(payload.payload.userId);
            }
          }
        })
        .subscribe((status) => {
          console.log(`📡 Supabase typing channel subscription status:`, status);
          if (status === 'SUBSCRIBED') {
            console.log(`📡 ✅ Successfully subscribed to Supabase typing channel ${channelName}`);
            typingChannelRef.current = typingChannel;
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`📡 ❌ Error subscribing to Supabase typing channel ${channelName}`);
          }
        });
    }
    
    return () => {
      console.log('🎯 Cleaning up typing subscriptions');
      if (typingChannel) {
        console.log('📡 Unsubscribing from Supabase typing channel');
        typingChannel.unsubscribe();
        typingChannelRef.current = null;
      }
      if (gunTypingUnsubscribe) gunTypingUnsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingTimeoutId.current) clearTimeout(typingTimeoutId.current);
    };
  }, [threadId, user, gunConnected, gunAuthenticated, connectedPeers, addTypingUser, removeTypingUser]);

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
      setImageFeatureEnabled(localStorage.getItem('xrpchat_feature_media_files') === 'true');
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

  // Enhanced loading timeout with better UX
  useEffect(() => {
    if (loading || !threadDetails) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
        console.log('Loading timeout reached - showing retry option');
      }, 10000); // Reduced to 10 seconds for better UX
      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading, threadDetails]);
  
  // Prevent multiple refresh triggers
  useEffect(() => {
    let refreshInProgress = false;
    
    const handleBeforeUnload = () => {
      refreshInProgress = true;
    };
    
    const handleUnload = () => {
      refreshInProgress = false;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

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

  // Enhanced loading screen with smooth transitions
  if (loading || !threadDetails) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <div className="text-gray-600 dark:text-gray-400 mb-2">Loading messages...</div>
          
          {/* Only show reload button after a delay to prevent immediate clicking */}
          {loadingTimeout && (
            <button
              className={`mt-2 text-blue-600 dark:text-blue-400 text-sm flex items-center justify-center mx-auto hover:text-blue-800 dark:hover:text-blue-300 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              onClick={handleRefreshMessages}
              style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <HiRefresh className="w-5 h-5 mr-1" />
              <span>Retry</span>
            </button>
          )}
          
          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400 max-w-md mx-auto bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 natural-light:bg-natural-background natural-dark:bg-natural-dark-background transition-colors duration-200 animate-fade-in"
      onClick={(e) => {
        // Prevent any clicks from causing refresh
        e.stopPropagation();
      }}
    >
      {profileRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-100 text-yellow-800 text-center py-1 text-xs">Refreshing profile...</div>
      )}
      
      {/* Connection Status Banner */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'error' || isReconnecting) && (
        <div className={`absolute top-0 left-0 right-0 z-40 text-center py-2 text-xs ${
          connectionStatus === 'error' ? 'bg-red-100 text-red-800' : 
          isReconnecting ? 'bg-blue-100 text-blue-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          <div className="flex items-center justify-center space-x-2">
            {isReconnecting ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-800"></div>
                <span>Reconnecting to chat...</span>
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <span>❌ Connection failed</span>
                {/* Reload button removed to prevent refresh issues */}
              </>
            ) : (
              <>
                <div className="animate-pulse h-2 w-2 bg-yellow-600 rounded-full"></div>
                <span>Reconnecting...</span>
              </>
            )}
          </div>
          {connectionError && (
            <div className="text-xs text-gray-600 mt-1">{connectionError}</div>
          )}
        </div>
      )}
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
          
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-1" title={
            gunConnected && gunAuthenticated && gunConnectionHealth?.hasRealPeers
              ? `🌐 P2P Network Active - Direct peer-to-peer messaging (${connectedPeers} peers connected)` 
              : gunConnected && gunAuthenticated && !gunConnectionHealth?.hasRealPeers
              ? `📱 P2P Local Mode - Using device storage only (${connectedPeers} local peers)`
              : connectionStatus === 'connected'
              ? `☁️ Cloud Mode - Using secure server connection for messaging`
              : connectionStatus === 'connecting' || isReconnecting
              ? `🔄 Connecting to messaging service...`
              : connectionStatus === 'error'
              ? `❌ Connection Error: ${connectionError || 'Unable to connect to messaging service'}`
              : `⚫ Offline - No connection to messaging service`
          }>
            {/* Neon green pulsing dot for all connected states */}
            <div className={`relative ${
              gunConnected && gunAuthenticated && gunConnectionHealth?.hasRealPeers ||
              gunConnected && gunAuthenticated && !gunConnectionHealth?.hasRealPeers ||
              connectionStatus === 'connected'
                ? 'neon-status-dot' 
                : connectionStatus === 'connecting' || isReconnecting
                ? 'connecting-status-dot'
                : connectionStatus === 'error'
                ? 'error-status-dot'
                : 'offline-status-dot'
            }`}>
              <div className="w-2 h-2 rounded-full bg-current"></div>
            </div>
            <div className="flex items-center space-x-1 text-xs text-white/80">
              {gunConnected && gunAuthenticated && gunConnectionHealth?.hasRealPeers ? (
                <>
                  <span>P2P</span>
                  <span className="text-white/60">({connectedPeers})</span>
                </>
              ) : gunConnected && gunAuthenticated && !gunConnectionHealth?.hasRealPeers ? (
                <>
                  <span>P2P</span>
                  <span className="text-white/60">(Local)</span>
                </>
              ) : connectionStatus === 'connected' ? (
                <>
                  <HiCloud size={12} className="text-white/80" />
                  <span>Cloud</span>
                </>
              ) : connectionStatus === 'connecting' || isReconnecting ? (
                <>
                  <span>Con</span>
                  <div className="connecting-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </div>
                </>
              ) : connectionStatus === 'error' ? (
                <span className="text-red-300">Error</span>
              ) : (
                <span className="text-gray-400">Offline</span>
              )}
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRefreshMessages();
            }}
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

      {/* Encrypted view banner */}
      {showEncrypted && (
        <div className="px-4 py-3 border-l-4 border-brand-primary/50 bg-brand-primary/10 rounded-md text-gray-900 dark:text-white">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <IoLockClosed className="h-5 w-5 text-current" />
            </div>
            <div className="ml-3">
              <p className="text-sm leading-relaxed">
                <span className="font-medium">Encrypted view:</span> You’re seeing the ciphertext exactly as it’s sent over the network. It can only be decrypted with the correct private key.
              </p>
            </div>
          </div>
        </div>
      )}

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
                          className={`px-3 py-1.5 rounded-lg shadow bg-white dark:bg-gray-700 natural-dark:bg-[#F5EEE0] text-gray-800 dark:text-white natural-dark:text-gray-800 rounded-bl-none transition-transform duration-500 ${isDeleting ? 'explode-out' : ''}`}
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
                          <div className="flex items-center justify-between mt-1 space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(message.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              className="text-gray-400 hover:text-red-600 p-0.5 rounded-full transition-colors"
                              style={{ display: isDeleting ? 'none' : 'inline-flex' }}
                              onClick={() => handleDeleteMessage(message.id)}
                              tabIndex={-1}
                              aria-label="Delete message"
                            >
                              <HiTrash size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="max-w-[75%] relative">
                        <div
                          className={`px-3 py-1.5 rounded-lg shadow bg-[#dcf8c6] dark:bg-brand-secondary natural-dark:bg-[#D2BC9B] text-gray-800 dark:text-white natural-dark:text-gray-800 rounded-br-none transition-transform duration-500 ${isDeleting ? 'explode-out' : ''}`}
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
                          <div className="flex items-center justify-between mt-1 space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(message.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              className="text-gray-400 hover:text-red-600 p-0.5 rounded-full transition-colors"
                              style={{ display: isDeleting ? 'none' : 'inline-flex' }}
                              onClick={() => handleDeleteMessage(message.id)}
                              tabIndex={-1}
                              aria-label="Delete message"
                            >
                              <HiTrash size={12} />
                            </button>
                          </div>
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
            
            {/* Typing Indicators */}
            {liveTypingEnabled && Array.from(typingUsers).map(userId => {
              if (userId === user?.id) return null; // Don't show our own typing
              return (
                <div key={`typing-${userId}`} className="flex items-end justify-start mb-4">
                  <DiceBearAvatar 
                    url={participants[userId]?.avatar_url}
                    size={32}
                    className="flex-shrink-0 mr-2"
                    userId={userId}
                    seed={participants[userId]?.avatar_seed || undefined}
                  />
                  <div className="max-w-[75%]">
                    <div className="px-3 py-1.5 rounded-lg shadow bg-white dark:bg-gray-700 natural-dark:bg-[#F5EEE0] text-gray-800 dark:text-white natural-dark:text-gray-800 rounded-bl-none">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {participants[userId]?.username || 'User'}
                      </p>
                      <span className="italic text-gray-500 dark:text-gray-400">
                        typing<span className="animate-bounce">...</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
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

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSend(e);
          }}
          className="flex items-center space-x-2 transition-all duration-200"
        >
          {/* Visual indicator for scrollable textarea - only show when 3+ lines and at max height */}
          {isAtMaxHeight && isMultiLine && (
            <div className="absolute right-16 bottom-14 pointer-events-none">
              <div className="bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900 text-xs px-2 py-1 rounded-full opacity-75 animate-pulse">
                Scroll to see more
              </div>
            </div>
          )}
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
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              console.log('🔤 Textarea changed, liveTypingEnabled:', liveTypingEnabled, 'user:', !!user);
              if (user && liveTypingEnabled) {
                const isTyping = e.target.value.length > 0;
                console.log(`🔤 Typing event - isTyping: ${isTyping}, gunConnected: ${gunConnected}`);
                
                // Clear previous timeout
                if (typingTimeoutId.current) {
                  clearTimeout(typingTimeoutId.current);
                  typingTimeoutId.current = null;
                }
                
                // Send typing indicator via Gun.js if connected and authenticated and has peers, otherwise Supabase
                if (gunConnected && gunAuthenticated && connectedPeers > 0) {
                  const typingKey = `typing_${threadId}`;
                  const typingData = {
                    isTyping,
                    timestamp: new Date().toISOString()
                  };
                  gun.get('typing').get(typingKey).get(user.id).put(typingData);
                  console.log(`🔫 Gun.js: Sent typing indicator: ${isTyping} for user ${user.id} in key ${typingKey}`);
                  
                  // Auto-clear typing indicator after 2 seconds of no typing
                  if (isTyping) {
                    typingTimeoutId.current = setTimeout(() => {
                      const clearData = {
                        isTyping: false,
                        timestamp: new Date().toISOString()
                      };
                      gun.get('typing').get(typingKey).get(user.id).put(clearData);
                      console.log(`🔫 Gun.js: Auto-cleared typing indicator for user ${user.id}`);
                    }, 2000);
                  }
                } else {
                  // Supabase fallback
                  console.log(`📡 Supabase: Sending typing indicator: ${isTyping} for user ${user.id} in thread ${threadId}`);
                  
                  if (typingChannelRef.current) {
                    typingChannelRef.current.send({
                      type: 'broadcast',
                      event: 'typing',
                      payload: { userId: user.id, isTyping }
                    }).then(() => {
                      console.log(`📡 ✅ Sent typing indicator via Supabase: ${isTyping}`);
                    }).catch((error: any) => {
                      console.error(`📡 ❌ Failed to send typing indicator via Supabase:`, error);
                    });
                  } else {
                    console.log(`📡 ❌ No typing channel available to send indicator`);
                  }
                }
              }
            }}
            onKeyDown={(e) => {
              // Send message on Enter, allow new line on Shift+Enter
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (!sending && newMessage.trim()) {
                  handleSend(e as any);
                }
              }
              // Allow Shift+Enter for new lines without triggering send
            }}
            onFocus={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Just focus, no other actions
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Just click, no other actions
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              // Prevent any mouse events from bubbling
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            style={{
              height: `${textareaHeight}px`,
              maxHeight: `${maxTextareaHeight}px`,
              minHeight: '64px', // Two-line minimum height
              resize: 'none',
              transition: 'height 0.2s ease-out',
              lineHeight: '1.5' // Better line spacing for readability
            }}
            className="flex-1 auto-expand-textarea border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-2 focus:outline-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 leading-relaxed scroll-smooth transition-all duration-200"
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
      
      {/* Auto-refresh messages periodically to maintain connection */}
      {connectionStatus === 'connected' && (
        <RefreshInterval onRefresh={handleRefreshMessages} intervalMs={300000} />
      )}
    </div>
  );
};

// Background refresh component to maintain connection health
const RefreshInterval: React.FC<{ onRefresh: () => void; intervalMs: number }> = ({ onRefresh, intervalMs }) => {
  useEffect(() => {
    console.log(`🔄 Starting background refresh interval: ${intervalMs}ms`);
    const interval = setInterval(() => {
      console.log('🔄 Background refresh triggered');
      onRefresh();
    }, intervalMs);
    
    return () => {
      console.log('🛑 Stopping background refresh interval');
      clearInterval(interval);
    };
  }, [onRefresh, intervalMs]);
  
  return null;
};

// Page transition wrapper component
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEntered, setIsEntered] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsEntered(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className={`page-transition ${isEntered ? 'page-entered' : 'page-entering'}`}>
      {children}
    </div>
  );
};

// Wrap Chat export with ErrorBoundary and PageTransition
const ChatWithBoundary: React.FC = (props) => (
  <ErrorBoundary>
    <PageTransition>
      <Chat {...props} />
    </PageTransition>
  </ErrorBoundary>
);

export default ChatWithBoundary;
