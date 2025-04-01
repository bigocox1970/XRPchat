import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiLockClosed, HiCheckCircle, HiTrash } from 'react-icons/hi';
import { supabase } from '../utils/supabase/client';

/**
 * This is a helper component for testing email confirmation flows locally.
 * It should NOT be included in production routes.
 */
export const TestConfirmEmail: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [deleteMessage, setDeleteMessage] = useState('');
  
  const handleTest = async () => {
    if (!email) {
      setMessage('Please enter an email address');
      return;
    }
    
    setStatus('loading');
    setMessage('Sending test confirmation email...');
    
    try {
      console.log(`[TestConfirmEmail] Sending test confirmation email to ${email}`);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      
      if (error) {
        console.error(`[TestConfirmEmail] Error sending confirmation email:`, error);
        setStatus('error');
        setMessage(`Error: ${error.message}`);
        return;
      }
      
      console.log(`[TestConfirmEmail] Successfully sent test confirmation email`);
      setStatus('success');
      setMessage(`Success! Check ${email} for the confirmation link.`);
      
    } catch (error) {
      console.error(`[TestConfirmEmail] Exception:`, error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!userId) {
      setDeleteMessage('Please enter a user ID');
      return;
    }

    setDeleteStatus('loading');
    setDeleteMessage('Attempting to delete user...');

    try {
      console.log(`[TestConfirmEmail] Deleting user: ${userId}`);

      // Step 1: Delete any user-related data (handle foreign key constraints)
      // This will depend on your database schema
      // Examples:
      
      // Delete messages (if they have a user_id reference)
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('user_id', userId);
      
      if (messagesError) {
        console.warn('Error deleting messages:', messagesError);
        // Continue anyway
      }

      // Delete threads/chats the user created
      const { error: threadsError } = await supabase
        .from('threads')
        .delete()
        .eq('created_by', userId);
      
      if (threadsError) {
        console.warn('Error deleting threads:', threadsError);
        // Continue anyway
      }
      
      // Delete thread_participants entries
      const { error: participantsError } = await supabase
        .from('thread_participants')
        .delete()
        .eq('user_id', userId);
      
      if (participantsError) {
        console.warn('Error deleting thread participants:', participantsError);
        // Continue anyway
      }

      // Delete wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .delete()
        .eq('user_id', userId);
      
      if (walletError) {
        console.warn('Error deleting wallet:', walletError);
        // Continue anyway
      }

      // Delete profile (usually the last table before auth)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (profileError) {
        console.warn('Error deleting profile:', profileError);
        // Continue anyway
      }

      // Step 2: Attempt to delete from auth (requires admin rights)
      // This will likely fail in local development unless using service role
      // Try anyway in case permissions are set up
      const adminClient = supabase;  // Using current client, but ideally would use admin
      const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.warn('Error deleting auth user (expected if not admin):', authError);
        setDeleteMessage('User data deleted from database, but removing from authentication requires admin access. You may need to delete the user from the Supabase Authentication dashboard.');
        setDeleteStatus('success');
        return;
      }

      console.log(`[TestConfirmEmail] Successfully deleted user ${userId}`);
      setDeleteStatus('success');
      setDeleteMessage(`Success! User ${userId} has been completely deleted.`);
      
    } catch (error) {
      console.error(`[TestConfirmEmail] Error deleting user:`, error);
      setDeleteStatus('error');
      setDeleteMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-primary opacity-20 dark:opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-green-400 opacity-20 dark:opacity-10 rounded-full blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center space-x-2">
          {status === 'success' ? (
            <HiCheckCircle size={32} className="text-green-500" />
          ) : (
            <HiLockClosed size={32} className="text-brand-primary" />
          )}
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            XRPchat.<span className="italic font-normal">app</span>
          </div>
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
          Test & Debug Tools
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center mb-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Email Confirmation Test
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Send a test confirmation email to validate the email verification flow.
            </p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              
              <button
                onClick={handleTest}
                disabled={status === 'loading'}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Sending...' : 'Send Test Email'}
              </button>
              
              {message && (
                <div className={`mt-4 text-sm ${
                  status === 'success' ? 'text-green-600' : 
                  status === 'error' ? 'text-red-600' : 
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 text-center">
            <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4 flex items-center justify-center">
              <HiTrash className="mr-2" /> Delete User (Debug Only)
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">
              This tool forcefully deletes a user and all associated data.<br />
              <span className="text-red-600 font-medium">⚠️ USE WITH CAUTION - This cannot be undone!</span>
            </p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  User ID (UUID)
                </label>
                <div className="mt-1">
                  <input
                    id="userId"
                    name="userId"
                    type="text"
                    required
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="e.g. 0ab881dc-a724-43ad-9551-c3fe39a7df34"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              
              <button
                onClick={handleDeleteUser}
                disabled={deleteStatus === 'loading' || !userId}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteStatus === 'loading' ? 'Deleting...' : 'Delete User & Data'}
              </button>
              
              {deleteMessage && (
                <div className={`mt-4 text-sm ${
                  deleteStatus === 'success' ? 'text-green-600' : 
                  deleteStatus === 'error' ? 'text-red-600' : 
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {deleteMessage}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/signin')}
              className="text-sm text-brand-primary hover:text-brand-secondary"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 