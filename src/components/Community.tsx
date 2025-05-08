import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiHeart, HiLightningBolt, HiUsers, HiCurrencyDollar, HiGlobe, HiCheckCircle, HiChip, HiCode } from 'react-icons/hi';
import { FaBitcoin } from 'react-icons/fa';
import { SiCardano } from 'react-icons/si';

// XRP Logo as a custom SVG component
const XRPLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 256 256" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    fill="currentColor"
  >
    <path d="M128 0C57.28 0 0 57.28 0 128s57.28 128 128 128 128-57.28 128-128S198.72 0 128 0zm42.34 96.37l-30.69 30.69c-6.069 6.069-15.91 6.069-21.98 0L87 96.37h-27.09l41.41 41.41c14 14 36.69 14 50.67 0l41.41-41.41H166.34zm-29.75 63.26L176.03 128h-27.09l-19.38 19.37c-6.067 6.067-15.92 6.067-21.99 0L88.18 128H61.09l37.44 31.63c11.71 11.71 30.53 11.71 42.06 0z"/>
  </svg>
);

// XDC Logo as a custom SVG component
const XDCLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 700 700" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    fill="currentColor"
  >
    <path d="M350 0C156.67 0 0 156.67 0 350s156.67 350 350 350 350-156.67 350-350S543.33 0 350 0zm-166.78 210.04h89.59l161.37 279.92h-89.59L183.22 210.04zm251.67 0h89.59l-161.37 279.92h-89.59l161.37-279.92z"/>
  </svg>
);

export const Community: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeCrypto, setActiveCrypto] = useState<'xrp' | 'xdc' | 'ada' | 'btc'>('xrp');
  
  const cryptoAddresses = {
    xrp: 'rDGwtazsKPKeMuadGhiQdBuwYH9j8xYspq', // XRP - no memo needed
    xdc: 'xdc1f557C509E7f3A955c532Da463F70e5d0483176A', // XDC
    ada: 'DdzFFzCqrhsfJssny1WfReSLpJTLquFi2Z3vCPvUvZEtnZupGxEC3uEZAPZAY6HomGkbgNGH1cLuF8YJy1DuqQna6WCkqAS1FZp59YTV', // ADA
    btc: '3D6NWx2ZHSpmL4PtyyAYXveTMsXSa71vgd' // BTC
  };

  const handleCopyAddress = (type: 'xrp' | 'xdc' | 'ada' | 'btc') => {
    navigator.clipboard.writeText(cryptoAddresses[type]);
    setCopied(type);
    setTimeout(() => setCopied(null), 3000);
  };

  // Get the appropriate logo for each cryptocurrency
  const getCryptoLogo = (type: 'xrp' | 'xdc' | 'ada' | 'btc') => {
    switch (type) {
      case 'xrp':
        return <XRPLogo className="w-5 h-5" />;
      case 'xdc':
        return <XDCLogo className="w-5 h-5" />;
      case 'ada':
        return <SiCardano className="w-4 h-4" />;
      case 'btc':
        return <FaBitcoin className="w-4 h-4" />;
      default:
        return <HiCurrencyDollar className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <div className="inline-block p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
          <HiHeart className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          Join Our Community & 
          <span className="block text-brand-primary">Support the Project</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Help us build a safer, more private digital world with end-to-end encrypted messaging and XRPL identity verification.
        </p>
      </section>

      {/* Why Support Section */}
      <section className="space-y-12 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
          Why Support XRPchat?
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
              <HiLightningBolt className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Support Innovation</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your donations directly fund the development of cutting-edge features and improvements to the platform, ensuring XRPchat remains at the forefront of secure communication technology.
            </p>
          </div>

          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
              <HiUsers className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Empower Privacy</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Help us continue offering a free, privacy-focused alternative to mainstream messaging apps that harvest user data. Your contribution strengthens digital privacy for everyone.
            </p>
          </div>

          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
              <HiGlobe className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Expand Accessibility</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your donations help us reach more users by funding server infrastructure, marketing efforts, and making the app available on more platforms and in more languages.
            </p>
          </div>

          <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
              <HiChip className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Enhance Security</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Contributions allow us to conduct regular security audits, implement advanced security features, and maintain the highest standard of protection for your conversations.
            </p>
          </div>
        </div>
      </section>

      {/* Donation Section */}
      <section className="bg-gradient-to-br from-brand-primary to-brand-primary-dark text-white py-16 px-6 rounded-2xl max-w-5xl mx-auto">
        <div className="space-y-8 text-center">
          <div className="inline-block p-3 bg-white/20 rounded-full">
            <HiCurrencyDollar className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-3xl font-bold">Make a Donation</h2>
          
          <p className="text-xl max-w-2xl mx-auto">
            Your donation, no matter the size or cryptocurrency, makes a significant impact on our ability to maintain and improve XRPchat.
          </p>
          
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl max-w-3xl mx-auto">
            {/* Crypto selection tabs */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-white/10 rounded-lg p-1 mb-2 flex-wrap">
                <button
                  onClick={() => setActiveCrypto('xrp')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    activeCrypto === 'xrp' 
                      ? 'bg-white text-brand-primary' 
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <XRPLogo className="w-5 h-5" />
                  <span>XRP</span>
                </button>
                <button
                  onClick={() => setActiveCrypto('xdc')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    activeCrypto === 'xdc' 
                      ? 'bg-white text-brand-primary' 
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <XDCLogo className="w-5 h-5" />
                  <span>XDC</span>
                </button>
                <button
                  onClick={() => setActiveCrypto('ada')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    activeCrypto === 'ada' 
                      ? 'bg-white text-brand-primary' 
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <SiCardano className="w-4 h-4" />
                  <span>ADA</span>
                </button>
                <button
                  onClick={() => setActiveCrypto('btc')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    activeCrypto === 'btc' 
                      ? 'bg-white text-brand-primary' 
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <FaBitcoin className="w-4 h-4" />
                  <span>BTC</span>
                </button>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold mb-4">
              Send {activeCrypto.toUpperCase()} to:
            </h3>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-6">
              <div className="flex-1 flex flex-col items-center">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <code className="bg-white/20 py-3 px-4 rounded-lg text-sm md:text-base font-mono break-all">
                    {cryptoAddresses[activeCrypto]}
                  </code>
                  <button 
                    onClick={() => handleCopyAddress(activeCrypto)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    title="Copy address"
                  >
                    {copied === activeCrypto ? <HiCheckCircle className="w-6 h-6" /> : <HiCode className="w-6 h-6" />}
                  </button>
                </div>
                
                {activeCrypto === 'xrp' && (
                  <div className="text-white text-sm mt-2">
                    No memo needed
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex justify-center">
                <img 
                  src={`/img/${activeCrypto}-qr.png`}
                  alt={`${activeCrypto.toUpperCase()} Donation QR Code`}
                  className="max-w-[220px] rounded-lg border-4 border-white/30" 
                />
              </div>
            </div>
            
            <p className="mt-6 text-sm text-white/80">
              Donations are non-refundable and help us maintain and improve the XRPchat platform.
              Always double-check the address before sending funds.
            </p>
          </div>
        </div>
      </section>

      {/* How Donations Are Used */}
      <section className="space-y-12 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
          How We Use Your Donations
        </h2>
        
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center shrink-0">
              <HiChip className="w-8 h-8 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Server Infrastructure</h3>
              <p className="text-gray-600 dark:text-gray-300">
                We maintain reliable, high-performance servers to ensure your messages are delivered instantly and securely. Your donations help us scale our infrastructure as our user base grows.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center shrink-0">
              <HiCode className="w-8 h-8 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Development Resources</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Building cutting-edge security features and maintaining a modern, intuitive interface requires significant development resources. Your contributions directly support our development team.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-start gap-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center shrink-0">
              <HiLightningBolt className="w-8 h-8 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">New Features</h3>
              <p className="text-gray-600 dark:text-gray-300">
                We're constantly working on new features to enhance your messaging experience. Donations enable us to invest in innovative capabilities while maintaining our commitment to privacy and security.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Join Community Section */}
      <section className="text-center bg-gray-100 dark:bg-gray-800 py-16 px-4 rounded-xl max-w-5xl mx-auto">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-block p-3 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-full">
            <HiUsers className="w-8 h-8 text-brand-primary" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Join Our Community</h2>
          
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Connect with other privacy enthusiasts, get the latest updates, and help shape the future of XRPchat.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://x.com/xrpchatapp" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-8 py-3 bg-[#000000] text-white rounded-lg hover:bg-[#222222] transition-colors text-lg font-semibold"
            >
              Follow on X
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center space-y-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Ready to Experience Secure Messaging?
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Join thousands of users who've chosen XRPchat for secure, private conversations.
        </p>
        <Link
          to="/signup"
          className="inline-block px-8 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-lg font-semibold"
        >
          Get Started Now
        </Link>
      </section>
    </div>
  );
}; 