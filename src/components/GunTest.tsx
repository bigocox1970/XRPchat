import React, { useState } from 'react';
import { useGun } from '../context/GunContext';
import { runGunTestSuite, TestSuite } from '../utils/gun/testing';

export const GunTest: React.FC = () => {
  const { 
    isConnected, 
    connectedPeers, 
    currentUser, 
    isAuthenticated,
    migrationStatus,
    signIn,
    signUp
  } = useGun();

  const [testResults, setTestResults] = useState<TestSuite | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testUser, setTestUser] = useState<{ address: string; privateKey: string } | null>(null);

  // Run the Gun.js test suite
  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    
    try {
      const results = await runGunTestSuite({ enableLogging: true, timeoutMs: 10000, retryAttempts: 3 });
      setTestResults(results);
    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Create a test user
  const handleCreateTestUser = async () => {
    try {
      const result = await signUp(`TestUser_${Date.now()}`);
      setTestUser({ address: result.address, privateKey: result.privateKey });
    } catch (error) {
      console.error('Failed to create test user:', error);
    }
  };

  // Sign in with test user
  const handleSignInTestUser = async () => {
    if (!testUser) return;
    
    try {
      await signIn(testUser.address, testUser.privateKey);
    } catch (error) {
      console.error('Failed to sign in test user:', error);
    }
  };

  const getStatusColor = (status: boolean) => status ? 'text-green-600' : 'text-red-600';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Gun.js P2P Testing Dashboard
        </h1>

        {/* Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Connection Status</h3>
            <p className={`font-mono ${getStatusColor(isConnected)}`}>
              {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Peers: {connectedPeers}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Authentication</h3>
            <p className={`font-mono ${getStatusColor(isAuthenticated)}`}>
              {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
            </p>
            {currentUser && (
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                User: {currentUser.username || currentUser.address.slice(0, 8)}...
              </p>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Migration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Phase: {migrationStatus?.phase || 'Unknown'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gun: {migrationStatus?.gunEnabled ? '✅' : '❌'} | 
              Supabase: {migrationStatus?.supabaseEnabled ? '✅' : '❌'}
            </p>
          </div>
        </div>

        {/* Test User Management */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Test User Management</h3>
          <div className="flex gap-4 mb-4">
            <button
              onClick={handleCreateTestUser}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Create Test User
            </button>
            {testUser && (
              <button
                onClick={handleSignInTestUser}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Sign In Test User
              </button>
            )}
          </div>
          
          {testUser && (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">Test User Created:</p>
              <p className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                Address: {testUser.address}
              </p>
            </div>
          )}
        </div>

        {/* Test Suite Controls */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">P2P Functionality Tests</h3>
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
          >
            {isRunningTests ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Running Tests...
              </>
            ) : (
              '🚀 Run Gun.js Test Suite'
            )}
          </button>
          
          {isRunningTests && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              This may take up to 30 seconds to complete...
            </p>
          )}
        </div>

        {/* Test Results */}
        {testResults && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Test Results</h3>
            
            {/* Summary */}
            <div className={`p-4 rounded-lg mb-4 ${
              testResults.passed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                 : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            } border`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${testResults.passed ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                  {testResults.passed ? '✅ All Tests Passed' : '❌ Some Tests Failed'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {testResults.passedTests}/{testResults.totalTests} passed ({testResults.duration}ms)
                </span>
              </div>
            </div>

            {/* Individual Test Results */}
            <div className="space-y-2">
              {testResults.results.map((result, index) => (
                <div key={index} className={`p-3 rounded-lg border ${
                  result.passed ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                                : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      result.passed ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                    }`}>
                      {result.passed ? '✅' : '❌'} {result.name}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {result.duration}ms
                    </span>
                  </div>
                  {!result.passed && result.error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Error: {result.error.message}
                    </p>
                  )}
                  {result.details && (
                    <div className="mt-2">
                      <details className="text-xs text-gray-600 dark:text-gray-400">
                        <summary className="cursor-pointer">Show Details</summary>
                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            Testing Instructions
          </h3>
          <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>First, check that Gun.js is connected (should show connected peers)</li>
            <li>Create a test user to test authentication</li>
            <li>Run the test suite to verify P2P functionality</li>
            <li>Check the browser console for detailed logging</li>
            <li>Tests include: connectivity, auth, messaging, contacts, and real-time sync</li>
          </ol>
        </div>
      </div>
    </div>
  );
};