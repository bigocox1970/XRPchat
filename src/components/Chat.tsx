import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useEncryption } from '../context/EncryptionContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useDebugMode } from '../context/DebugModeContext';
import { supabase, getThreadMessages, sendMessage, markMessageAsRead, subscribeToThread, getProfile } from '../utils/supabase/index';
import { HiX, HiPaperAirplane } from 'react-icons/hi';
import { Avatar } from './Avatar';
import type { Database } from '../types/supabase';

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

const MessageContent: React.FC<{
  content: string;
  showEncrypted: boolean;
}> = ({ content, showEncrypted }) => {
  const { decryptMessage } = useEncryption();
  const [decryptedContent, setDecryptedContent] = useState<string>(content);
  const [isDecrypted, setIsDecrypted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const decrypt = async () => {
      if (!isDecrypted) {
        try {
          const decrypted = await decryptMessage(content);
          if (mounted) {
            setDecryptedContent(decrypted);
            setIsDecrypted(true);
          }
        } catch (error) {
          if (mounted) {
            setDecryptedContent(content);
            setIsDecrypted(true);
          }
        }
      }
    };

    if (!isDecrypted) {
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
        decryptedContent
      )}
    </p>
  );
};

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const [participants, setParticipants] = useState<ThreadParticipants>({});
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useUser();
  const { notificationsEnabled } = useNotification();
  const { encryptForRecipient, decryptMessage } = useEncryption();
  const { showEncrypted } = useEncryptionMode();
  const { debugMode } = useDebugMode();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

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
      navigate('/contacts');
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(threadId)) {
      navigate('/');
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
          navigate('/');
          return;
        }

        // Verify user is a participant
        if (!data.participant_ids.includes(user.id)) {
          navigate('/');
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

  // Load messages and handle subscriptions
  useEffect(() => {
    const loadMessages = async () => {
      if (!threadId || !user) return;
      
      try {
        const messages = await getThreadMessages(threadId);
        setMessages(messages.reverse()); // Reverse to show oldest first
        
        // Mark unread messages as read
        messages.forEach(async (message) => {
          if (!message.read && message.sender_id !== user.id) {
            await markMessageAsRead(message.id, user.id);
          }
        });
      } catch (error) {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Subscribe to new messages
    if (!threadId) return;

    const unsubscribe = subscribeToThread(
      threadId,
      async (payload) => {
        if (payload.new && user) {
          const message = payload.new;
          
          // Mark message as read if it's not from the current user
          if (message.sender_id !== user.id) {
            await markMessageAsRead(message.id, user.id);
            
            // Show notification if enabled and window is not focused
            if (notificationsEnabled && !document.hasFocus() && 'Notification' in window && Notification.permission === 'granted') {
              const senderName = participants[message.sender_id]?.username || 'Someone';
              new Notification(`New message from ${senderName}`, {
                body: showEncrypted ? 'New encrypted message' : await decryptMessage(message.content),
              });
            }
          }
          
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
        }
      },
      () => {}
    );

    return () => {
      unsubscribe();
    };
  }, [threadId, user]);

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
      setNewMessage('');
    } catch (error) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

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
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close chat"
        >
          <HiX size={24} />
        </button>
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

        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
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
