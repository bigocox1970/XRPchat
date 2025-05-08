import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HiMenu, HiX, HiLogout, HiHome, HiSparkles, HiShieldCheck, HiQuestionMarkCircle, HiArrowRight, HiHeart } from 'react-icons/hi';
import { HiQrCode } from 'react-icons/hi2';
import { useUser } from '../context/UserContext';
import { useDarkMode } from '../context/DarkModeContext';
import { supabase } from '../utils/supabase/client';

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
      navigate('/signup');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 natural-dark:bg-[#D2BC9B] flex flex-col overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary opacity-[0.05] dark:opacity-10 natural-dark:bg-[#8B5A2B] natural-dark:opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-400 opacity-[0.05] dark:opacity-10 natural-dark:bg-[#A67C52] natural-dark:opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-400 opacity-[0.05] dark:opacity-10 natural-dark:bg-[#D2BC9B] natural-dark:opacity-10 rounded-full blur-3xl"></div>
        </div>
      </div>
      {/* Header */}
      <header className="bg-brand-primary natural-dark:bg-natural-dark-primary text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[22px] flex items-center justify-between">
          {/* Left side - Logo and Name */}
          <div className="flex items-center space-x-2">
            <HiQrCode size={24} className="text-white" />
            <div className="text-xl font-bold text-white">
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
                  className="text-white/80 hover:text-white"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/signin"
                  className="text-white/80 hover:text-white"
                >
                  Sign In
                </Link>
              )}
              <Link
                to="/"
                className={`text-white/80 hover:text-white ${
                  isActiveRoute('/') ? 'text-white' : ''
                }`}
              >
                Home
              </Link>
              <Link
                to="/website/features"
                className={`text-white/80 hover:text-white ${
                  isActiveRoute('/website/features') ? 'text-white' : ''
                }`}
              >
                Features
              </Link>
              <Link
                to="/website/security"
                className={`text-white/80 hover:text-white ${
                  isActiveRoute('/website/security') ? 'text-white' : ''
                }`}
              >
                Security
              </Link>
              <Link
                to="/website/faq"
                className={`text-white/80 hover:text-white ${
                  isActiveRoute('/website/faq') ? 'text-white' : ''
                }`}
              >
                FAQ
              </Link>
              <Link
                to="/website/community"
                className={`text-white/80 hover:text-white ${
                  isActiveRoute('/website/community') ? 'text-white' : ''
                }`}
              >
                Community
              </Link>
              <DarkModeToggle />
            </nav>

            {/* Go to App Button */}
            <button
              onClick={handleGoToApp}
              className="hidden lg:block px-6 py-2 bg-white text-brand-primary rounded-lg hover:bg-white/90 transition-colors"
            >
              Go to App
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10"
            >
              {sidebarOpen ? <HiX size={24} className="text-white" /> : <HiMenu size={24} className="text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sidebar */}
        <div
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:hidden fixed inset-y-0 left-0 w-full bg-white dark:bg-gray-800 natural-dark:bg-[#F5EEE0] shadow-lg transition-transform duration-300 ease-in-out z-50`}
        >
          <nav className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="bg-brand-primary text-white py-[22px] px-4 shadow-md">
              <div className="flex items-center space-x-2">
                <HiQrCode size={24} className="text-white" />
                <div className="text-xl font-bold">
                  XRPchat<span className="italic font-normal">.app</span>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-1 flex-1">
            <Link
              to="/"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiHome size={24} />
              <span>Home</span>
            </Link>
            <Link
              to="/website/features"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/features') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiSparkles size={24} />
              <span>Features</span>
            </Link>
            <Link
              to="/website/security"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/security') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiShieldCheck size={24} />
              <span>Security</span>
            </Link>
            <Link
              to="/website/faq"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/faq') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiQuestionMarkCircle size={24} />
              <span>FAQ</span>
            </Link>
            <Link
              to="/website/community"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActiveRoute('/website/community') ? 'text-brand-primary dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HiHeart size={24} />
              <span>Community</span>
            </Link>
            <div className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
              <span>Theme</span>
              <div className="ml-auto">
                <DarkModeToggle />
              </div>
            </div>
            <button
              onClick={() => {
                handleGoToApp();
                setSidebarOpen(false);
              }}
              className="block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 w-full text-left"
            >
              Go to App
            </button>
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
              >
                <HiLogout size={24} />
                <span>Logout</span>
              </button>
            ) : (
              <Link
                to="/signin"
                className="block px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                onClick={() => setSidebarOpen(false)}
              >
                Sign In
              </Link>
            )}
            </div>
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
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
};
