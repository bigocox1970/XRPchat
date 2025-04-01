import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { HiDownload, HiShare, HiClipboard, HiClipboardCheck } from 'react-icons/hi';
import { useUser } from '../context/UserContext';
import { CopyButton } from './CopyButton';

export const NewChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const qrRef = useRef<SVGSVGElement>(null);

  // SVG to Canvas conversion for download functionality
  useEffect(() => {
    if (!profile?.wallet_address) return;

    // Schedule this after the component has rendered
    const timeoutId = setTimeout(() => {
      try {
        // Get the SVG element
        const svgElement = document.getElementById('qr-code');
        if (!svgElement) {
          console.error('Could not find QR code SVG element');
          return;
        }

        // Create a new canvas element
        const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
        if (!canvas) {
          console.error('Could not find canvas element');
          return;
        }

        // Create an SVG string from the SVG element
        const svg = new XMLSerializer().serializeToString(svgElement);

        // Create a blob from the SVG string
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        // Create an image element from the blob
        const img = new Image();
        img.onload = () => {
          try {
            // Set canvas dimensions to match the image
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image onto the canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
            }

            // Clean up the URL
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Error drawing image on canvas:', err);
          }
        };

        img.onerror = (err) => {
          console.error('Error loading image:', err);
          URL.revokeObjectURL(url);
        };

        img.src = url;
      } catch (err) {
        console.error('Error in SVG to canvas conversion:', err);
      }
    }, 500); // Slight delay to ensure SVG has rendered

    return () => clearTimeout(timeoutId);
  }, [profile?.wallet_address]);

  // Function to download QR code as PNG
  const downloadQRCode = () => {
    try {
      const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.error('Canvas element not found');
        return;
      }

      // Convert canvas to data URL
      const pngUrl = canvas.toDataURL('image/png');
      
      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${profile?.username || 'user'}-qr-code.png`;
      
      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  // Function to share QR code (if Web Share API is available)
  const shareQRCode = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: 'My XRPchat QR Code',
          text: `Scan this QR code to chat with me on XRPchat! My wallet address is: ${profile?.wallet_address}`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  // Function to copy wallet address
  const handleCopy = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <div className="text-xl font-semibold">QR</div>
          </div>
          <div>
            <div className="font-semibold">Share QR Code</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-6 space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Share Your QR Code
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Let others scan this QR code to add you as a contact and start chatting!
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              {profile?.wallet_address ? (
                <>
                  <QRCodeSVG
                    id="qr-code"
                    value={profile.wallet_address}
                    size={250}
                    level="H"
                    includeMargin={true}
                    className="rounded"
                    ref={qrRef}
                  />
                  <canvas 
                    id="qr-code-canvas" 
                    style={{ display: 'none' }}
                    width="250" 
                    height="250"
                  />
                </>
              ) : (
                <div className="w-[250px] h-[250px] flex items-center justify-center bg-gray-100 rounded">
                  <p className="text-gray-500">No wallet address available</p>
                </div>
              )}
            </div>

            {/* Wallet Address */}
            <div className="w-full bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Your Wallet Address:
              </div>
              <div className="flex items-center justify-between relative">
                <div className="font-mono text-sm text-gray-800 dark:text-gray-200 truncate max-w-xs">
                  {profile?.wallet_address || 'No wallet address available'}
                </div>
                <div className="flex items-center">
                  <button
                    onClick={handleCopy}
                    className={`p-1 rounded transition-colors ${copied ? 'text-green-500' : 'text-gray-500 dark:text-white hover:text-green-500'}`}
                    title="Copy address"
                    disabled={!profile?.wallet_address}
                  >
                    {copied ? <HiClipboardCheck size={20} /> : <HiClipboard size={20} />}
                    <span className="sr-only">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              {copied && (
                <div className="text-xs text-green-500 mt-1 text-right">Address copied to clipboard!</div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 w-full">
              <button
                onClick={downloadQRCode}
                className="flex-1 flex items-center justify-center space-x-2 bg-brand-primary hover:bg-brand-secondary text-white py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                disabled={!profile?.wallet_address}
              >
                <HiDownload size={20} />
                <span>Download QR Code</span>
              </button>
              
              {canShare && (
                <button
                  onClick={shareQRCode}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2"
                  disabled={!profile?.wallet_address}
                >
                  <HiShare size={20} />
                  <span>Share</span>
                </button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              How to Use QR Codes in XRPchat
            </h3>
            <ol className="space-y-3 text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <span className="font-bold mr-2">1.</span>
                <span>Share your QR code with friends you want to chat with</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">2.</span>
                <span>They can scan your QR code from their Contacts page by clicking "Add Contact" and using the QR scanner</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">3.</span>
                <span>Once added as contacts, you can start secure, encrypted conversations with each other</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">4.</span>
                <span>To add someone else, go to Contacts and use the QR scanner to add them</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}; 