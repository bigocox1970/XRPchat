import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useEncryption } from '../context/EncryptionContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { supabase, getThreadMessages, sendMessage, markMessageAsRead, subscribeToThread, getProfile } from '../utils/supabase';
import { HiUser, HiX, HiPaperAirplane } from 'react-icons/hi';
import type { Database } from '../types/supabase';

type Message = Database['public']['Tables']['messages']['Row'];

interface ThreadDetails {
  name: string;
  participant_ids: string[];
}

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useUser();
  const { encryptForRecipient, decryptMessage } = useEncryption();
  const { showEncrypted } = useEncryptionMode();
  
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
      console.error('Invalid thread ID format');
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
          console.error('Error loading thread details:', error);
          setError('Failed to load chat. Please try again.');
          return;
        }
        
        if (!data) {
          console.error('Thread not found');
          navigate('/');
          return;
        }

        // Verify user is a participant
        if (!data.participant_ids.includes(user.id)) {
          console.error('User is not a participant in this thread');
          navigate('/');
          return;
        }

        setThreadDetails(data);
      } catch (error) {
        console.error('Error loading thread details:', error);
        setError('Failed to load chat. Please try again.');
      }
    };

    loadThreadDetails();
  }, [threadId, user, navigate]);

  useEffect(() => {
    if (!threadId || !user || threadId === 'new') {
      console.log('No threadId or user:', { threadId, userId: user?.id });
      return;
    }

    console.log('Initializing chat with:', { threadId, userId: user.id });
    
    let unsubscribe: (() => void) | undefined;
    let isSubscriptionActive = true;

    const initializeChat = async () => {
      try {
        // Load initial messages
        await loadMessages();
        
        // Only proceed with subscription if component is still mounted
        if (!isSubscriptionActive) {
          console.log('Component unmounted before subscription setup');
          return;
        }
        
        console.log('Setting up thread subscription');
        unsubscribe = subscribeToThread(
          threadId,
          async (payload) => {
            // Verify subscription is still active before processing
            if (!isSubscriptionActive) {
              console.log('Ignoring message - subscription no longer active');
              return;
            }

            console.log('New message received:', payload);
            if (payload.new) {
              await handleNewMessage(payload);
              
              // Show notification if message is from other user and window is not focused
              if (payload.new.sender_id !== user.id && document.hidden) {
                try {
                  if ('Notification' in window && Notification.permission === 'granted') {
                    const sender = await getProfile(payload.new.sender_id);
                    const decryptedContent = await decryptMessage(payload.new.content);
                    new Notification('New Message', {
                      body: `${sender?.username}: ${decryptedContent}`,
                    });
                  }
                } catch (error) {
                  console.error('Error showing notification:', error);
                }
              }
            }
          },
          handleThreadUpdate
        );

        // Request notification permission if needed
        if ('Notification' in window && Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (error) {
            console.error('Error requesting notification permission:', error);
          }
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setError('Failed to initialize chat. Please try refreshing the page.');
        
        // Cleanup subscription if it exists
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = undefined;
        }
      }
    };

    initializeChat();

    return () => {
      console.log('Cleaning up chat resources');
      isSubscriptionActive = false;
      if (unsubscribe) {
        console.log('Cleaning up thread subscription');
        unsubscribe();
      }
    };
  }, [threadId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!threadId) return;

    try {
      console.log('Loading messages for thread:', threadId);
      setLoading(true);
      const messages = await getThreadMessages(threadId);
      console.log('Retrieved messages:', messages);
      
      // Decrypt messages
      console.log('Decrypting messages...');
      const decryptedMessages = await Promise.all(
        messages.map(async (message) => {
          try {
            const decryptedContent = await decryptMessage(message.content);
            return { ...message, content: decryptedContent };
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return { ...message, content: 'Failed to decrypt message' };
          }
        })
      );
      
      console.log('Messages decrypted successfully');
      // Sort messages by created_at in ascending order (oldest first)
      const sortedMessages = decryptedMessages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sortedMessages);

      // Mark unread messages as read
      const unreadMessages = messages.filter(
        (m) => !m.read && m.sender_id !== user?.id
      );
      await Promise.all(
        unreadMessages.map((m) => markMessageAsRead(m.id))
      );
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = async (payload: { new: Message, eventType: string }) => {
    try {
      console.log('Processing new message:', {
        event: payload.eventType,
        message: payload.new,
        threadId: payload.new.thread_id,
        currentThread: threadId,
        senderId: payload.new.sender_id,
        currentUser: user?.id
      });

      // Verify message belongs to current thread
      if (payload.new.thread_id !== threadId) {
        console.log('Message is for a different thread, ignoring');
        return;
      }

      // Decrypt message content
      console.log('Decrypting message content...');
      const decryptedContent = await decryptMessage(payload.new.content);
      const newMessage = { ...payload.new, content: decryptedContent };
      
      setMessages((prev) => {
        // Check if message already exists
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) {
          console.log('Message already exists in state:', newMessage.id);
          return prev;
        }
        
        // Add new message and sort by timestamp
        const updated = [...prev, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        console.log('Updated messages state:', {
          previousCount: prev.length,
          newCount: updated.length,
          addedMessageId: newMessage.id
        });
        return updated;
      });
      
      if (payload.new.sender_id !== user?.id) {
        await markMessageAsRead(payload.new.id);
      }

      // Scroll to bottom after state update
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  };

  const handleThreadUpdate = () => {
    // Handle thread updates if needed
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !user || !newMessage.trim()) {
      console.log('Missing required data:', { threadId, userId: user?.id, hasMessage: Boolean(newMessage.trim()) });
      return;
    }

    try {
      console.log('Sending message in thread:', threadId);
      setSending(true);
      setError(null);
      
      // Get thread details to find the recipient
      console.log('Fetching thread details...');
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('participant_ids')
        .eq('id', threadId)
        .single();
      
      if (threadError) {
        console.error('Error fetching thread:', threadError);
        throw threadError;
      }
      
      if (!thread) {
        console.error('Thread not found');
        throw new Error('Thread not found');
      }
      
      console.log('Thread details:', thread);
      
      // Find the other participant (recipient) from participant_ids
      const recipientId = thread.participant_ids.find((id: string) => id !== user.id);
      if (!recipientId) {
        console.error('No recipient found in thread');
        throw new Error('No recipient found');
      }

      console.log('Found recipient:', recipientId);

      // Encrypt message
      console.log('Encrypting message...');
      const encryptedContent = await encryptForRecipient(
        newMessage.trim(),
        recipientId
      );
      console.log('Message encrypted successfully');

      // Send message
      console.log('Sending encrypted message...');
      await sendMessage(threadId, user.id, encryptedContent);
      console.log('Message sent successfully');
      
      setNewMessage('');
    } catch (error) {
      console.error('Detailed error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to send message: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="h-full flex flex-col bg-[#efeae2] dark:bg-gray-900">
      {/* Chat Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiUser size={24} />
          </div>
          <div>
            <div className="font-semibold">{threadDetails?.name || 'Chat'}</div>
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
          {messages.map((message) => {
            const isUserMessage = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-lg px-4 py-2 rounded-lg shadow ${
                    isUserMessage
                      ? 'bg-[#dcf8c6] dark:bg-brand-secondary text-gray-800 dark:text-white rounded-br-none'
                      : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {showEncrypted ? (
                      <span className="font-mono text-xs">{message.content}</span>
                    ) : (
                      message.content
                    )}
                  </p>
                  <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
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
