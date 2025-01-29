import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { HiMenu, HiX, HiChat, HiUserGroup, HiUser, HiPlus, HiLockClosed, HiLogout, HiEye, HiEyeOff } from 'react-icons/hi';
import { HiQrCode } from 'react-icons/hi2';
import { useDarkMode } from '../context/DarkModeContext';
import { useEncryptionMode } from '../context/EncryptionModeContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const { user, profile, signOut } = useUser();
  const { showEncrypted, toggleEncryptionMode } = useEncryptionMode();
  const { DarkModeToggle } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex overflow-hidden relative">
      {/* Sidebar Toggle Button - Mobile */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 right-16 z-50 p-2 rounded-full bg-brand-primary text-white shadow-lg"
      >
        {sidebarOpen ? <HiX size={24} /> : <HiMenu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:static lg:translate-x-0 z-40 w-72 transition-transform duration-300 ease-in-out flex-shrink-0 h-screen`}
      >
        <div className="w-full h-full bg-white dark:bg-gray-800 shadow-lg flex flex-col overflow-hidden">
          {/* User Profile Section */}
          {/* App Header */}
          <div className="bg-brand-primary text-white py-[22px] px-4">
            <div className="flex items-center space-x-2">
              <HiLockClosed size={24} className="text-white" />
              <div className="text-lg font-bold">
                SecureChat.<span className="italic font-normal text-base">Crypto</span>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="px-4 py-3 mt-2.5 bg-white dark:bg-gray-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <HiUser size={24} className="text-gray-600 dark:text-gray-300" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div className="font-semibold text-gray-900 dark:text-white truncate">{profile?.username}</div>
                <button 
                  onClick={() => setShowQRModal(true)} 
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" 
                  title="Show QR Code"
                >
                  <HiQrCode size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2 pb-6">
            <button
              onClick={() => navigate('/chat/new')}
              className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <HiPlus size={24} className="text-green-600" />
              <span>New Chat</span>
            </button>

            <Link
              to="/"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/') ? 'bg-green-50 dark:bg-gray-700 text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <HiChat size={24} />
              <span>Chats</span>
            </Link>

            <Link
              to="/contacts"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/contacts') ? 'bg-green-50 dark:bg-gray-700 text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <HiUserGroup size={24} />
              <span>Contacts</span>
            </Link>

            <Link
              to="/profile"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/profile') ? 'bg-green-50 dark:bg-gray-700 text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <HiUser size={24} />
              <span>Profile</span>
            </Link>

            {/* Settings Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 space-y-2">
              {/* Dark Mode Toggle */}
              <div className="px-4 py-3">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <DarkModeToggle />
                  <span>Theme</span>
                </div>
              </div>

              {/* Encryption Mode Toggle */}
              <button
                onClick={toggleEncryptionMode}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {showEncrypted ? (
                  <>
                    <HiEyeOff size={24} />
                    <span>Hide Encrypted Text</span>
                  </>
                ) : (
                  <>
                    <HiEye size={24} />
                    <span>Show Encrypted Text</span>
                  </>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={signOut}
                className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
        {children}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
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
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                <div className="font-medium mb-1">Wallet Address</div>
                <div className="font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                  {profile?.wallet_address || 'No wallet address available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
