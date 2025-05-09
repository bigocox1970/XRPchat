import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { HiMenu, HiX, HiChat, HiUserGroup, HiUser, HiPlus, HiLogout, HiCog, HiBell, HiVolumeUp, HiUserAdd, HiMail, HiRefresh } from 'react-icons/hi';
import { HiQrCode } from 'react-icons/hi2';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { DiceBearAvatar } from './DiceBearAvatar';
import { useEncryptionMode } from '../context/EncryptionModeContext';
import { useNotificationSubscriptions } from '../hooks/useNotificationSubscriptions';
import { supabaseAdmin } from '../utils/supabase/client';

export const Layout: React.FC = () => {
  // Initialize notification subscriptions
  useNotificationSubscriptions();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { user, profile, signOut, refreshProfile } = useUser();
  const { isMaxSecurityEnabled } = useEncryptionMode();
  const { 
    unreadCount,
    soundUnlocked,
    unlockAudio,
    playNotificationSound
  } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Add state to track if refreshing is in progress
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Add state to track if audio is being unlocked
  const [unlockingAudio, setUnlockingAudio] = useState(false);

  // Request notification permission on component mount if not already granted
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // This is now handled in the Settings page
    }
  }, []);
  
  // Handle refreshing data
  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple refreshes
    
    setIsRefreshing(true);
    console.log("Refreshing data...");
    
    try {
      // Refresh user profile data
      await refreshProfile();
      
      // Create and dispatch a custom event to notify other components
      const refreshEvent = new CustomEvent('app-refresh', { 
        detail: { path: location.pathname } 
      });
      window.dispatchEvent(refreshEvent);
      
      // Add a small delay to show the refresh animation
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Handle unlocking audio with user interaction
  const handleUnlockAudio = async () => {
    setUnlockingAudio(true);
    try {
      const success = await unlockAudio();
      if (success) {
        // Play a test sound to confirm it's working
        setTimeout(() => {
          playNotificationSound();
        }, 300);
      }
    } catch (error) {
      console.error('Failed to unlock audio:', error);
    } finally {
      setUnlockingAudio(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const isActiveRoute = (path: string) => {
    // For chat routes, we want to match if the current path starts with "/app/chat/"
    if (path === '/app/chats' && location.pathname.startsWith('/app/chat/')) {
      return true;
    }
    // Special case for new chat
    if (path === '/app/chat/new' && location.pathname === '/app/chat/new') {
      return true;
    }
    // For other routes, exact matching
    return location.pathname === path;
  };

  // Navigate to the QR code sharing page
  const handleNewChat = () => {
    navigate('/app/chat/new');
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 natural-dark:bg-[#D2BC9B] flex overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Sidebar glow */}
        <div className="absolute top-0 left-0 w-96 h-screen">
          <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-brand-primary opacity-[0.0025] dark:opacity-5 natural-dark:bg-natural-dark-primary natural-dark:opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[200px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-green-400 opacity-[0.0025] dark:opacity-5 natural-dark:bg-natural-dark-accent natural-dark:opacity-5 rounded-full blur-3xl"></div>
        </div>
        {/* Main content glow */}
        <div className="absolute left-96 inset-y-0 right-0">
          <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-primary opacity-[0.004] dark:opacity-10 natural-dark:bg-natural-dark-primary natural-dark:opacity-10 rounded-full blur-3xl"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-green-400 opacity-[0.004] dark:opacity-10 natural-dark:bg-natural-dark-accent natural-dark:opacity-10 rounded-full blur-3xl"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-blue-400 opacity-[0.004] dark:opacity-10 natural-dark:bg-[#D2BC9B] natural-dark:opacity-10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
      
      {/* Mobile Header Controls - Add refresh button next to hamburger menu */}
      <div className="lg:hidden fixed top-4 right-4 z-50 flex items-center space-x-2">
        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-full bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white shadow-lg"
          aria-label="Refresh"
        >
          <HiRefresh size={24} className={isRefreshing ? "animate-spin" : ""} />
        </button>
        
        {/* Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white shadow-lg"
        >
          {sidebarOpen ? <HiX size={24} /> : <HiMenu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:static lg:translate-x-0 z-40 w-full lg:w-96 transition-transform duration-300 ease-in-out flex-shrink-0 h-screen`}
      >
        <div className="w-full h-full bg-white dark:bg-gray-800 natural-dark:bg-[#F5EEE0] shadow-lg flex flex-col overflow-hidden">
          {/* User Profile Section */}
          {/* App Header */}
          <div className="bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white py-[22px] px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HiQrCode size={24} className="text-white" />
                <div className="text-xl font-bold">
                  XRPchat<span className="italic font-normal">.app</span>
                  {isMaxSecurityEnabled && (
                    <span className="ml-2 text-xs bg-yellow-500 text-black px-1 py-0.5 rounded-sm uppercase font-semibold">
                      Max Security
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Notification indicator */}
                {unreadCount > 0 && (
                  <div className="relative">
                    <HiBell size={20} className="text-white" />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </div>
                )}
                
                {/* Desktop Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="hidden lg:block text-white"
                  aria-label="Refresh"
                >
                  <HiRefresh size={20} className={isRefreshing ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>

      {/* User Profile */}
      <div className="px-4 py-3 mt-2.5 bg-white dark:bg-gray-800 natural-dark:bg-natural-dark-paper">
        <div className="flex items-center space-x-3">
          <DiceBearAvatar url={profile?.avatar_url} size={40} userId={user?.id} seed={profile?.avatar_seed || undefined} />
          <div className="flex-1 flex items-center justify-between">
            <div className="font-semibold text-gray-900 dark:text-white truncate">{profile?.username}</div>
            <Link 
              to="/app/connect" 
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border rounded-lg" 
              title="Connect with QR Code"
            >
              <HiQrCode size={20} className="text-gray-600 dark:text-gray-300" />
            </Link>
          </div>
        </div>
      </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2 pb-6">
            {/* Connect (moved to top) */}
            <Link
              to="/app/connect"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border ${
                isActiveRoute('/app/connect') ? 'bg-green-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border text-brand-primary dark:text-white natural-dark:text-natural-dark-primary' : 'text-gray-700 dark:text-gray-200 natural-dark:text-natural-dark-text'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiQrCode size={24} className="text-green-600 natural-dark:text-natural-dark-primary" />
              <span>Connect</span>
            </Link>

            {/* Chats */}
            <Link
              to="/app/chats"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border ${
                isActiveRoute('/app/chats') ? 'bg-green-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border text-brand-primary dark:text-white natural-dark:text-natural-dark-primary' : 'text-gray-700 dark:text-gray-200 natural-dark:text-natural-dark-text'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiChat size={24} className="natural-dark:text-natural-dark-primary" />
              <span>Chats</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* Rest of the navigation */}
            <Link
              to="/app/contacts"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border ${
                isActiveRoute('/app/contacts') ? 'bg-green-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border text-brand-primary dark:text-white natural-dark:text-natural-dark-primary' : 'text-gray-700 dark:text-gray-200 natural-dark:text-natural-dark-text'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiUserGroup size={24} className="natural-dark:text-natural-dark-primary" />
              <span>Contacts</span>
            </Link>

            <Link
              to="/app/profile"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border ${
                isActiveRoute('/app/profile') ? 'bg-green-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border text-brand-primary dark:text-white natural-dark:text-natural-dark-primary' : 'text-gray-700 dark:text-gray-200 natural-dark:text-natural-dark-text'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiUser size={24} className="natural-dark:text-natural-dark-primary" />
              <span>Profile</span>
            </Link>

            <Link
              to="/app/settings"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border ${
                isActiveRoute('/app/settings') ? 'bg-green-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border text-brand-primary dark:text-white natural-dark:text-natural-dark-primary' : 'text-gray-700 dark:text-gray-200 natural-dark:text-natural-dark-text'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiCog size={24} className="natural-dark:text-natural-dark-primary" />
              <span>Settings</span>
            </Link>

            <div className="flex-1"></div>

            {/* Bottom Links */}
            <div className="border-t border-gray-200 dark:border-gray-700 natural-dark:border-natural-dark-border pt-2 space-y-2">
              <Link
                to="/website"
                className="block px-4 py-3 text-gray-600 dark:text-gray-400 natural-dark:text-natural-dark-text hover:text-brand-primary dark:hover:text-brand-primary natural-dark:hover:text-natural-dark-primary transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                Visit Website
              </Link>

              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-600 dark:text-gray-400 natural-dark:text-natural-dark-text hover:text-brand-primary dark:hover:text-brand-primary natural-dark:hover:text-natural-dark-primary transition-colors text-left"
              >
                <HiUserAdd size={24} />
                <span>Invite User</span>
              </button>

              <button
                onClick={signOut}
                className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border rounded-lg"
              >
                <HiLogout size={24} />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full overflow-hidden">
        <Outlet />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 natural-dark:bg-natural-dark-paper rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white natural-dark:text-natural-dark-text">Your QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 natural-dark:text-natural-dark-text natural-dark:hover:text-natural-dark-primary"
              >
                <HiX size={24} />
              </button>
            </div>
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-2 rounded-lg">
                <QRCodeSVG
                  value={profile?.wallet_address || ''}
                  size={192}
                  level="H"
                  includeMargin={true}
                  className="bg-white"
                />
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 natural-dark:text-natural-dark-text text-center">
                <div className="font-medium mb-1">Wallet Address</div>
                <div className="font-mono bg-gray-100 dark:bg-gray-700 natural-dark:bg-natural-dark-border p-2 rounded break-all">
                  {profile?.wallet_address || 'No wallet address available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white dark:bg-gray-800 natural-dark:bg-natural-dark-paper rounded-lg shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <HiUserAdd className="text-brand-primary natural-dark:text-natural-dark-primary" size={24} />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white natural-dark:text-natural-dark-text">Invite User</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 natural-dark:text-natural-dark-text natural-dark:hover:text-natural-dark-primary"
              >
                <HiX size={24} />
              </button>
            </div>
            
            <InviteUserForm onClose={() => setShowInviteModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

// Simplified InviteUserForm component embedded within Layout
const InviteUserForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error('Email is required');
      }

      // Use Supabase admin to invite the user
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim());

      if (error) throw error;

      setMessage({
        text: `Invitation sent to ${email}`,
        type: 'success'
      });
      
      // Reset form
      setEmail('');
      
      // Close modal after success (optional)
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Error inviting user:', error);
      setMessage({
        text: error instanceof Error ? error.message : 'An error occurred while sending the invitation',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email Address
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <HiMail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="example@email.com"
          />
        </div>
      </div>

      {message && (
        <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </div>
    </form>
  );
};
