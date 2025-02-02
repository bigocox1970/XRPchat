import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HiMenu, HiX, HiLockClosed } from 'react-icons/hi';
import { useUser } from '../context/UserContext';
import { useDarkMode } from '../context/DarkModeContext';

import { Outlet } from 'react-router-dom';

export const WebsiteLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useUser();
  const { DarkModeToggle } = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const handleGoToApp = () => {
    if (user) {
      navigate('/app');
    } else {
      navigate('/website/signup');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/website/signin');
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary opacity-10 dark:opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-400 opacity-10 dark:opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-400 opacity-10 dark:opacity-10 rounded-full blur-3xl"></div>
        </div>
      </div>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          {/* Left side - Logo and Name */}
          <div className="flex items-center space-x-2">
            <HiLockClosed size={24} className="text-brand-primary" />
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              XRPchat<span className="italic font-normal">.app</span>
            </div>
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center space-x-4">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-white"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/website/signin"
                  className="text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-white"
                >
                  Sign In
                </Link>
              )}
              <Link
                to="/website"
                className={`text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-white ${
                  isActiveRoute('/website') ? 'text-brand-primary dark:text-white' : ''
                }`}
              >
                Home
              </Link>
              <Link
                to="/website/features"
                className={`text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-white ${
                  isActiveRoute('/website/features') ? 'text-brand-primary dark:text-white' : ''
                }`}
              >
                Features
              </Link>
              <Link
                to="/website/security"
                className={`text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-white ${
                  isActiveRoute('/website/security') ? 'text-brand-primary dark:text-white' : ''
                }`}
              >
                Security
              </Link>
              <Link
                to="/website/faq"
                className={`text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-white ${
                  isActiveRoute('/website/faq') ? 'text-brand-primary dark:text-white' : ''
                }`}
              >
                FAQ
              </Link>
              <DarkModeToggle />
            </nav>

            {/* Go to App Button */}
            <button
              onClick={handleGoToApp}
              className="hidden lg:block px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
            >
              Go to App
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {sidebarOpen ? <HiX size={24} className="text-gray-600 dark:text-gray-300" /> : <HiMenu size={24} className="text-gray-600 dark:text-gray-300" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <div
          className={`${
            sidebarOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
          } lg:hidden absolute top-full left-0 right-0 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out z-50`}
        >
          <nav className="p-4 space-y-2">
            <Link
              to="/website"
              className={`block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/website/features"
              className={`block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/features') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              Features
            </Link>
            <Link
              to="/website/security"
              className={`block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/security') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              Security
            </Link>
            <Link
              to="/website/faq"
              className={`block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/faq') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              FAQ
            </Link>
            {user ? (
              <button
                onClick={handleSignOut}
                className="block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                Sign Out
              </button>
            ) : (
              <Link
                to="/website/signin"
                className="block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                onClick={() => setSidebarOpen(false)}
              >
                Sign In
              </Link>
            )}
            <div className="px-4 py-2 flex items-center justify-between text-gray-700 dark:text-gray-200">
              <span>Theme</span>
              <DarkModeToggle />
            </div>
            <button
              onClick={() => {
                handleGoToApp();
                setSidebarOpen(false);
              }}
              className="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
            >
              Go to App
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
};
