import React, { useState } from 'react';
import { migrateExistingWallets } from '../utils/supabase/migrateExistingWallets';
import { useUser } from '../context/UserContext';

export const AdminTools: React.FC = () => {
  const { user } = useUser();
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  
  // Only admin users can use these tools
  // In a real app, this would be a proper admin check
  const isAdmin = user?.email?.includes('admin') || process.env.NODE_ENV === 'development';
  
  if (!isAdmin) {
    return null;
  }
  
  const handleMigrateWallets = async () => {
    if (!confirm('Are you sure you want to migrate all existing wallets to use PIN encryption? This will set a default PIN of "123456" for all wallets.')) {
      return;
    }
    
    setMigrationLoading(true);
    setMigrationResult(null);
    
    try {
      await migrateExistingWallets();
      setMigrationResult('Migration completed successfully! All users now have PIN-protected private keys with the default PIN of "123456"');
    } catch (error) {
      setMigrationResult(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setMigrationLoading(false);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6 mt-4">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white">Admin Tools</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        These tools are only visible to admin users.
      </p>
      
      <div className="mt-4">
        <h3 className="text-md font-medium text-gray-900 dark:text-white">PIN Migration</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Migrate all existing wallets to use PIN encryption with a default PIN of "123456".
        </p>
        
        <div className="mt-3">
          <button
            onClick={handleMigrateWallets}
            disabled={migrationLoading}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 ${
              migrationLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {migrationLoading ? 'Migrating...' : 'Migrate All Wallets'}
          </button>
        </div>
        
        {migrationResult && (
          <div className={`mt-3 text-sm ${migrationResult.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
            {migrationResult}
          </div>
        )}
      </div>
    </div>
  );
}; 