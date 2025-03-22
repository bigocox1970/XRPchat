import { useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { supabase, subscribeToUserThreads, subscribeToThread, activeSubscriptions } from '../utils/supabase/index';

export const useNotificationSubscriptions = () => {
  const { user } = useUser();
  const { 
    playNotificationSound, 
    showNotification, 
    incrementUnread, 
    notificationsEnabled,
    soundUnlocked,
    unlockAudio
  } = useNotification();
  
  // Use a ref to track subscriptions that need cleanup on unmount
  const subscriptionsRef = useRef<(() => void)[]>([]);
  // Use a ref to track and store the notification audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create a dedicated audio element for notifications in this component
  useEffect(() => {
    // Create a dedicated audio element for this hook
    const audio = new Audio('/sounds/notification.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Custom function to play notification sound that doesn't depend on the context
  const playSound = () => {
    try {
      // If sound is unlocked from context, we can try to play our local audio
      if (soundUnlocked && audioRef.current) {
        // Reset the audio to the beginning if it's already playing
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        console.log('Playing notification sound from subscription hook');
        audioRef.current.play().catch(error => {
          console.error('Error playing notification sound in hook:', error);
          // Fallback to context method if our local audio fails
          playNotificationSound();
        });
      } else {
        // If sound isn't unlocked yet, use the context method which has 
        // the logic to check sound unlocking status
        playNotificationSound();
      }
    } catch (error) {
      console.error('Error in subscription hook sound player:', error);
      // Fallback to context method
      playNotificationSound();
    }
  };

  // Set up global subscription to threads and messages
  useEffect(() => {
    if (!user) return;

    console.log('Setting up global notification listeners for user:', user.id);
    
    // Try to unlock audio - important to call this on component mount
    // and whenever we might need to play sounds
    unlockAudio().catch(e => console.warn('Could not unlock audio in hook:', e));
    
    // Subscribe to new threads
    const threadUnsubscribe = subscribeToUserThreads(user.id, (payload) => {
      console.log('New thread notification received in App:', payload);
      
      // Show notification if the thread was created by someone else and window is not focused
      if (payload.new && payload.new.created_by !== user.id && !document.hasFocus()) {
        // Always play sound for new threads
        playSound();
        
        if (notificationsEnabled) {
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
        }
      }
    });
    
    if (threadUnsubscribe) {
      subscriptionsRef.current.push(threadUnsubscribe);
    }
    
    // Function to subscribe to all user's threads for messages
    const subscribeToUserMessages = async () => {
      try {
        // Get all threads the user is part of
        const { data, error } = await supabase
          .from('threads')
          .select('id, participant_ids')
          .contains('participant_ids', [user.id]);
          
        if (error) {
          throw error;
        }
        
        if (data && data.length > 0) {
          console.log(`Setting up message subscriptions for ${data.length} threads`);
          
          // Subscribe to each thread for messages
          data.forEach((thread) => {
            // Subscribe to new messages in this thread
            const unsubscribe = subscribeToThread(
              thread.id, 
              (payload) => {
                if (payload.new && payload.new.sender_id !== user.id) {
                  console.log('New message received in App:', payload.new);
                  
                  // Always play notification sound for new messages
                  // regardless of which page the user is on
                  playSound();
                  
                  // Show notification if enabled
                  if (notificationsEnabled && !document.hasFocus()) {
                    // Get thread details from the payload
                    const threadId = payload.new.thread_id;
                    
                    supabase
                      .from('threads')
                      .select('name, participant_ids')
                      .eq('id', threadId)
                      .single()
                      .then(({ data: threadData }) => {
                        if (threadData) {
                          // Find the other participant
                          const otherParticipantId = threadData.participant_ids.find(
                            (id: string) => id !== user.id
                          );
                          
                          if (otherParticipantId) {
                            // Get the other participant's username
                            supabase
                              .from('profiles')
                              .select('username')
                              .eq('id', otherParticipantId)
                              .single()
                              .then(({ data: profileData }) => {
                                const username = profileData ? profileData.username : 'Someone';
                                
                                showNotification(`New message from ${username}`, {
                                  body: payload.new.content,
                                  data: {
                                    threadId,
                                    url: `/app/chat/${threadId}`
                                  },
                                  tag: `thread-${threadId}`
                                });
                                
                                // Increment unread counter
                                incrementUnread();
                              });
                          }
                        }
                      });
                  }
                }
              },
              (updatePayload) => {
                // This is the thread update handler
                // For thread updates, we don't need to show an error, just log it for debugging
                console.log(`Thread ${thread.id} updated:`, updatePayload);
              }
            );
            
            if (unsubscribe) {
              subscriptionsRef.current.push(unsubscribe);
            }
          });
        }
      } catch (error) {
        console.error('Error setting up message subscriptions:', error);
      }
    };
    
    // Initial subscription to messages
    subscribeToUserMessages();
    
    // Re-subscribe every 5 minutes to catch new threads
    const intervalId = setInterval(subscribeToUserMessages, 5 * 60 * 1000);
    
    // Cleanup
    return () => {
      clearInterval(intervalId);
      
      // Clean up all tracked subscriptions
      subscriptionsRef.current.forEach(unsubscribe => {
        unsubscribe();
      });
      subscriptionsRef.current = [];
    };
  }, [user, notificationsEnabled, showNotification, playNotificationSound, incrementUnread, soundUnlocked, unlockAudio]);
}; 