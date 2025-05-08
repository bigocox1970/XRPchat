import React from 'react';
import { Link } from 'react-router-dom';
import { HiLockClosed, HiChat, HiKey, HiClock, HiHeart } from 'react-icons/hi';
import { useUser } from '../context/UserContext';

export const Website: React.FC = () => {
  const { user } = useUser();

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white">
          Secure, End-to-End Encrypted Messaging
          <span className="block text-brand-primary">with XRPL Identity</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Experience truly private conversations with military-grade encryption and blockchain-based identity verification.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to={user ? '/app' : '/signup'}
            className="px-8 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-lg font-semibold"
          >
            {user ? 'Go to App' : 'Get Started'}
          </Link>
          <Link
            to="/website/community"
            className="px-8 py-3 bg-transparent border-2 border-brand-primary text-brand-primary rounded-lg hover:bg-brand-primary hover:text-white transition-colors text-lg font-semibold flex items-center gap-2"
          >
            <HiHeart className="text-red-500" />
            Support the Project
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
          Why Choose the XRP chat <i>app</i>?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center">
              <HiLockClosed className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">End-to-End Encryption</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your messages are encrypted before leaving your device and can only be decrypted by the intended recipient.
            </p>
          </div>

          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center">
              <HiKey className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">XRPL Identity</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your identity is secured by XRPL blockchain technology, ensuring authentic and verifiable communications.
            </p>
          </div>

          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center">
              <HiChat className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Real-Time Messaging</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Instant message delivery with real-time updates and secure message synchronisation.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="space-y-12">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl font-bold text-brand-primary dark:text-green-300">1</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create an Account</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Sign up with your email and set a username. Your keys are generated securely on your device.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl font-bold text-brand-primary dark:text-green-300">2</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Connect</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Share your QR code or connect with others using their XRPL address or username.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl font-bold text-brand-primary dark:text-green-300">3</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Chat Securely</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Send messages that are automatically encrypted and can only be read by your intended recipient.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-brand-primary text-white py-16 rounded-2xl">
        <div className="text-center space-y-8 max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold">Ready to Experience Secure Messaging?</h2>
          <p className="text-xl">
            Join thousands of users who value privacy and security in their communications.
          </p>
          <div>
            <Link
              to={user ? '/app' : '/signup'}
              className="px-8 py-3 bg-white text-brand-primary rounded-lg hover:bg-gray-100 transition-colors text-lg font-semibold inline-block"
            >
              {user ? 'Go to App' : 'Get Started'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
