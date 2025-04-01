import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase/client';
import { getRedirectURL } from '../utils/site-url';

/**
 * This is a helper component for testing email confirmation flows locally.
 * It should NOT be included in production routes.
 */
export const TestConfirmEmail: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState(getRedirectURL('confirm-email'));
  const navigate = useNavigate();

  const handleTestSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const password = 'Test1234!'; // Test password
      const username = `test_${Date.now()}`; // Generate unique username

      // Log what URL will be used for redirects
      console.log('Redirect URL that will be used:', siteUrl);

      // Test signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          },
          emailRedirectTo: siteUrl
        }
      });

      if (error) throw error;

      setMessage(`Test signup completed. Check ${email} for the confirmation link.
                 Username: ${username}, Password: ${password}`);
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Test signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Test Email Confirmation
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          This page is for testing email confirmation flows locally
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleTestSignUp}>
            <div>
              <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Site URL/Redirect URL
              </label>
              <div className="mt-1">
                <input
                  id="siteUrl"
                  name="siteUrl"
                  type="text"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Make sure this matches the URL configured in Supabase
              </p>
            </div>

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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            {message && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-line">{message}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-primary dark:hover:text-brand-primary"
                onClick={() => navigate('/')}
              >
                Back to home
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              >
                {loading ? 'Processing...' : 'Test Sign Up'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; 