import React from 'react';
import { Link } from 'react-router-dom';
import { HiLockClosed, HiChat, HiKey, HiClock } from 'react-icons/hi';
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
        <div className="flex justify-center gap-4">
          <Link
            to={user ? '/app' : '/website/signup'}
            className="px-8 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-lg font-semibold"
          >
            {user ? 'Go to App' : 'Get Started'}
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-12">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
          Why Choose SecureChat
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
              Instant message delivery with real-time updates and secure message synchronization.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="space-y-12">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
          How It Works
        </h2>
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">1. Secure Identity</h3>
              <p className="text-gray-600 dark:text-gray-300">
                When you sign up, we generate a secure XRPL wallet that serves as your unique identity. Your private key never leaves your device.
              </p>
            </div>
            <div className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              <img 
                src="./img/wallet.webp" 
                alt="Secure XRPL wallet identity illustration" 
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row-reverse items-center gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">2. End-to-End Encryption</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Messages are encrypted using military-grade encryption before being sent. Only the recipient's private key can decrypt the message.
              </p>
            </div>
            <div className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              {/* Placeholder for illustration */}
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">3. Instant Delivery</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Messages are delivered instantly through our real-time system, ensuring your conversations stay synchronized and secure.
              </p>
            </div>
            <div className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              {/* Placeholder for illustration */}
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-brand-primary text-white py-16 px-4 rounded-xl">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold">Ready to Start Secure Messaging?</h2>
          <p className="text-xl">
            Join SecureChat today and experience truly private conversations.
          </p>
          <Link
            to={user ? '/app' : '/website/signup'}
            className="inline-block px-8 py-3 bg-white text-brand-primary rounded-lg hover:bg-gray-100 transition-colors text-lg font-semibold"
          >
            {user ? 'Go to App' : 'Get Started'}
          </Link>
        </div>
      </section>
    </div>
  );
};
