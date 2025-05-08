import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { uploadAvatar } from '../utils/supabase/storage';
import { updateProfile } from '../utils/supabase/auth';
import { Avatar } from '../components/Avatar';

const Profile2: React.FC = () => {
  const { user, profile, loading } = useUser();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
    if (profile) {
      setUsername(profile.username || '');
      // Construct the full avatar URL
      if (profile.avatar_url) {
        setAvatarUrl(`https://aoqvffeqscehfnrjgjrs.supabase.co/storage/v1/object/public/avatar-storage/${profile.avatar_url}`);
      }
    }
  }, [user, loading, profile, navigate]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);
      
      const file = e.target.files?.[0];
      if (!file || !user) return;

      // Upload the avatar
      await uploadAvatar(file, user.id);
      
      // Update the profile with the new avatar URL
      const filePath = `${user.id}/avatar_${new Date().getTime()}.${file.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
      await updateProfile(user.id, {
        avatar_url: filePath
      });
      
      // Update the local state with the full avatar URL
      setAvatarUrl(`https://aoqvffeqscehfnrjgjrs.supabase.co/storage/v1/object/public/avatar-storage/${filePath}`);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      setError(null);
      await updateProfile(user.id, { username });
      navigate('/');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Edit Profile
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="mb-4">
              <Avatar url={avatarUrl} size={120} />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
              disabled={uploading}
            />
            {uploading && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile2; 