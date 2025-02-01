import React from 'react';
import { HiLockClosed, HiKey, HiShieldCheck } from 'react-icons/hi';

export const Security: React.FC = () => {
  return (
    <div className="space-y-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          Security Architecture
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          SecureChat is built with security at its core, using industry-standard encryption and blockchain technology.
        </p>
      </section>

      {/* End-to-End Encryption Section */}
      <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center">
            <HiLockClosed className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">End-to-End Encryption</h2>
        </div>
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p>
            All messages in SecureChat are protected with military-grade AES-256 encryption. Messages are encrypted on your device
            before being sent, and can only be decrypted by the intended recipient.
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white mt-6 mb-2">How It Works:</h3>
          <ol className="list-decimal list-inside space-y-2 pl-4">
            <li>Message is encrypted using recipient's public key</li>
            <li>Encrypted message is sent through secure channels</li>
            <li>Only recipient's private key can decrypt the message</li>
            <li>Servers never see the decrypted content</li>
          </ol>
        </div>
      </section>

      {/* XRPL Identity Section */}
      <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center">
            <HiKey className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">XRPL Identity</h2>
        </div>
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p>
            Your identity is secured by the XRP Ledger blockchain, providing a decentralized and cryptographically secure
            way to verify users and manage encryption keys.
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white mt-6 mb-2">Key Features:</h3>
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>Blockchain-based identity verification</li>
            <li>Private keys never leave your device</li>
            <li>Secure key generation and storage</li>
            <li>QR code sharing for easy and secure connections</li>
          </ul>
        </div>
      </section>

      {/* Additional Security Measures */}
      <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-100 rounded-lg flex items-center justify-center">
            <HiShieldCheck className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Additional Security Measures</h2>
        </div>
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 dark:text-white mr-2">•</span>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Zero Knowledge:</span>
                {' '}Our servers never have access to your decrypted messages or private keys.
              </div>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 dark:text-white mr-2">•</span>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Perfect Forward Secrecy:</span>
                {' '}Each message uses unique encryption keys, ensuring past messages remain secure even if a key is compromised.
              </div>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 dark:text-white mr-2">•</span>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Secure Infrastructure:</span>
                {' '}All data is stored and transmitted using industry-standard security protocols.
              </div>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 dark:text-white mr-2">•</span>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Open Source:</span>
                {' '}Our code is open for review, ensuring transparency and community-verified security.
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};
