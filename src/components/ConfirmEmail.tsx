import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { HiLockClosed, HiCheckCircle } from 'react-icons/hi';
import { supabase } from '../utils/supabase/client';
import { EmailOtpType } from '@supabase/supabase-js';

export const ConfirmEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your email...');
  const [debug, setDebug] = useState<string[]>([]);

  useEffect(() => {
    const verifySession = async () => {
      try {
        addDebug('Starting email verification process');
        addDebug(`URL Parameters: ${window.location.search}`);
        
        // Check for token_hash and type parameters
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        
        addDebug(`Found token_hash: ${tokenHash ? 'Yes' : 'No'}`);
        addDebug(`Found type: ${type ? type : 'No'}`);

        if (tokenHash && type) {
          addDebug('Verifying token with Supabase');
          // Verify the token using the Supabase verify OTP method
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });

          if (verifyError) {
            addDebug(`Token verification error: ${verifyError.message}`);
            throw verifyError;
          }
          
          addDebug('Token verified successfully');
        } else {
          addDebug('No token_hash or type found in URL, checking session directly');
        }

        // Check if we have a session now
        addDebug('Checking for active session');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          addDebug(`Session error: ${sessionError.message}`);
          throw sessionError;
        }

        if (session) {
          addDebug(`Session found, user is confirmed: ${session.user?.email}`);
          // If we have a session, the email has been confirmed
          setStatus('success');
          setMessage('Your email has been confirmed successfully! Thank you for verifying your account.');
          
          // Redirect to the sign-in page after a delay of 5 seconds
          addDebug('Scheduling redirect to sign-in page in 5 seconds');
          setTimeout(() => {
            navigate('/signin');
          }, 5000);
        } else {
          addDebug('No session found after verification attempt');
          
          // Check if there's an error message in the URL
          const errorDescription = searchParams.get('error_description');
          if (errorDescription) {
            addDebug(`Error description from URL: ${errorDescription}`);
            throw new Error(errorDescription);
          } else {
            // Try to check if the error was from an expired token
            if (tokenHash) {
              addDebug('Token may have expired or already been used');
              throw new Error('Verification link has expired or already been used. Please request a new one.');
            } else {
              addDebug('No verification token found in URL');
              throw new Error('Invalid verification link. Please check your email for the correct link.');
            }
          }
        }
      } catch (error) {
        addDebug(`Error in verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An error occurred while confirming your email');
        console.error('Error confirming email:', error);
      }
    };

    verifySession();
  }, [searchParams, navigate]);
  
  function addDebug(message: string) {
    console.log(`[ConfirmEmail] ${message}`);
    setDebug(prev => [...prev, message]);
  }

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
          Email Confirmation
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className={`text-lg mb-4 ${
              status === 'loading' ? 'text-gray-700 dark:text-gray-300' :
              status === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {message}
            </div>

            {status === 'loading' && (
              <div className="animate-pulse flex justify-center">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            )}

            {status === 'success' && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Redirecting to sign-in...
              </div>
            )}

            {status === 'error' && (
              <div className="mt-4 space-y-4">
                <div>
                  <Link
                    to="/signup"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                  >
                    Sign up again
                  </Link>
                </div>
                <div>
                  <Link
                    to="/signin"
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-primary dark:hover:text-brand-primary"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            )}
            
            {/* Debug information - can be removed in production */}
            {debug.length > 0 && (
              <div className="mt-8 text-left p-4 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono overflow-auto max-h-64">
                <div className="font-bold mb-2">Debug Info:</div>
                {debug.map((msg, i) => (
                  <div key={i} className="text-gray-600 dark:text-gray-300">
                    &gt; {msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 