import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { QRCodeSVG } from 'qrcode.react';
import { HiKey, HiLockClosed } from 'react-icons/hi';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useUser();
  const { setShowPrivateKey } = useEncryptionMode();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ privateKey: string; address: string } | null>(null);
  const [privateKeySaved, setPrivateKeySaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Basic validation
      if (!username.trim()) {
        throw new Error('Username is required');
      }
      if (!email.trim()) {
        throw new Error('Email is required');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const walletInfo = await signUp(email.trim(), password, username.trim());
      
      if (walletInfo) {
        setWalletInfo(walletInfo);
        setSuccess(true);
        setShowPrivateKey(true);
      } else {
        throw new Error('Failed to create account: No wallet information returned');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Display a more descriptive error message for debugging
      let errorMessage = 'An unexpected error occurred during sign up';
      if (error instanceof Error) {
        // Preserve the original error message for debugging purposes
        errorMessage = error.message;
        
        // Provide more user-friendly messages for common errors
        if (error.message.includes('Username is already taken')) {
          errorMessage = 'This username is already taken. Please choose another one.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('duplicate key value violates unique constraint')) {
          errorMessage = 'This username or email is already taken. Please choose another one.';
        }
      }
      
      setError(errorMessage);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (success && !privateKeySaved && walletInfo) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-6">
              <div>
                <h2 className="text-center text-2xl font-extrabold text-gray-900 dark:text-white">
                  Important Security Information
                </h2>
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-start">
                    <HiKey className="h-5 w-5 text-red-400 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Save Your Private Key</h3>
                      <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                        This private key will only be shown once. Save it in a secure location. You'll need it to enable maximum security mode.
                      </p>
                      <div className="mt-4">
                        <p className="text-sm text-red-700 dark:text-red-300 font-mono break-all">
                          {walletInfo?.privateKey}
                        </p>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            setPrivateKeySaved(true);
                            setShowPrivateKey(false);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          I've Saved My Private Key - Continue
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Account Created Successfully!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Please check your email to confirm your account.
          </p>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => navigate('/website/signin')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#075e54] hover:bg-[#128c7e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#075e54]"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center space-x-2">
          <HiLockClosed size={32} className="text-brand-primary" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            XRPchat.<span className="italic font-normal">app</span>
          </div>
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Join SecureChat to start messaging securely
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#075e54] focus:border-[#075e54] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Choose a unique username"
                  disabled={loading}
                />
              </div>
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#075e54] focus:border-[#075e54] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#075e54] focus:border-[#075e54] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Create a secure password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#075e54] hover:bg-[#128c7e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#075e54] ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </div>
                ) : (
                  'Sign up'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <button
                onClick={() => navigate('/website/signin')}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#075e54] dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Sign in
              </button>
              <Link
                to="/website"
                className="block text-center text-sm text-gray-600 dark:text-gray-400 hover:text-brand-primary dark:hover:text-brand-primary"
              >
                View Website
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
