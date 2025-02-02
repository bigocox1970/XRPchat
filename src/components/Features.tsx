import React from 'react';
import { HiLockClosed, HiKey, HiChat, HiClock, HiUserGroup, HiMoon } from 'react-icons/hi';

export const Features: React.FC = () => {
  return (
    <div className="space-y-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          Features
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          The XRP chat <i>app</i> combines powerful security features with an intuitive user experience.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* End-to-End Encryption */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center mb-6">
            <HiLockClosed className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">End-to-End Encryption</h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-300">
            <li>• Military-grade AES-256 encryption</li>
            <li>• Messages encrypted before leaving your device</li>
            <li>• Only recipients can decrypt messages</li>
            <li>• No plaintext data stored on servers</li>
          </ul>
        </div>

        {/* XRPL Identity */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center mb-6">
            <HiKey className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">XRPL Identity</h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-300">
            <li>• Blockchain-based identity verification</li>
            <li>• Secure key management</li>
            <li>• QR code sharing for easy connections</li>
            <li>• Decentralised authentication</li>
          </ul>
        </div>

        {/* Real-Time Messaging */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center mb-6">
            <HiChat className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Real-Time Messaging</h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-300">
            <li>• Instant message delivery</li>
            <li>• Live typing indicators</li>
            <li>• Read receipts</li>
            <li>• Message synchronisation</li>
          </ul>
        </div>

        {/* User Experience */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center mb-6">
            <HiMoon className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">User Experience</h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-300">
            <li>• Intuitive interface</li>
            <li>• Dark mode support</li>
            <li>• Mobile-friendly design</li>
            <li>• Seamless navigation</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
