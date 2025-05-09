import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { HiQrcode, HiCamera, HiClipboard, HiShare, HiX, HiPhotograph, HiPlus } from 'react-icons/hi';
import { useUser } from '../context/UserContext';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { searchUsers, addContact } from '../utils/supabase/auth';
import { CopyButton } from './CopyButton';

export const Connect: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const [showScanner, setShowScanner] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [showQrReader, setShowQrReader] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [qrCodeInstance, setQrCodeInstance] = useState<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  // Handle scanner cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear();
      }
      
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('Error stopping camera:', err));
      }
    };
  }, [scanner, html5QrCode]);

  // New useEffect to handle the scanner when showQrReader changes
  useEffect(() => {
    if (!showQrReader) {
      if (scanner) {
        scanner.clear();
        setScanner(null);
      }
      
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('Error stopping camera:', err));
      }
    }
  }, [showQrReader, scanner, html5QrCode]);

  // Add scanner initialization effect
  useEffect(() => {
    if (showScanner) {
      // Wait for the next tick to ensure DOM is updated
      setTimeout(() => {
        const element = document.getElementById('qr-reader');
        if (!element) {
          console.error('QR reader element not found');
          return;
        }

        const qrCodeInstance = new Html5Qrcode("qr-reader");
        setHtml5QrCode(qrCodeInstance);

        // Get available cameras first
        Html5Qrcode.getCameras().then(devices => {
          if (devices && devices.length > 0) {
            // Prefer back camera on mobile devices (usually last in the list)
            // or just use the first available camera
            const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;
            
            // Start the camera
            startCamera(qrCodeInstance, cameraId);
          } else {
            console.error("No cameras found");
            setError("No cameras found on your device");
          }
        }).catch(err => {
          console.error("Error getting cameras", err);
          setError("Couldn't access camera. Please check permissions.");
        });
      }, 0);
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('Error stopping camera:', err));
      }
    };
  }, [showScanner]);

  const handleCopyAddress = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addContactByWalletAddress = async (walletAddress: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const results = await searchUsers(walletAddress);
      if (!results || results.length === 0) {
        setError('No user found with this wallet address');
        return false;
      }
      
      // Check if trying to add yourself as a contact
      if (results[0].id === user?.id) {
        setError('You cannot add yourself as a contact');
        return false;
      }
      
      console.log('Adding contact with ID:', results[0].id);
      await addContact(results[0].id);
      
      // Show success message
      setSuccessMessage(`Successfully added ${results[0].username || 'contact'} to your contacts!`);
      
      // Clear manual entry if it was used
      setManualAddress('');
      setShowManualEntry(false);
      
      return true;
    } catch (error) {
      console.error('Error adding contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to add contact');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startCamera = (qrCodeInstance: Html5Qrcode, cameraId: string) => {
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
      videoConstraints: {
        facingMode: "environment",
        aspectRatio: 1.0
      }
    };
    
    qrCodeInstance.start(
      cameraId, 
      config,
      async (decodedText) => {
        console.log(`QR Code detected: ${decodedText}`);
        
        qrCodeInstance.stop().catch(err => {
          console.error("Error stopping camera after scan:", err);
        });
        
        setShowQrReader(false);
        setError(null);
        
        try {
          setLoading(true);
          await addContactByWalletAddress(decodedText);
          
          setTimeout(() => {
            setShowScanner(false);
          }, 1500);
        } catch (error) {
          console.error("Error processing scanned QR code:", error);
          setError(error instanceof Error ? error.message : 'Failed to process QR code');
        } finally {
          setLoading(false);
        }
      },
      (errorMessage) => {
        console.log(`QR Code scanning error: ${errorMessage}`);
      }
    ).catch(err => {
      console.error("Error starting camera:", err);
      setError("Couldn't start camera: " + (err instanceof Error ? err.message : String(err)));
    });
  };

  const handleScanClick = () => {
    setShowScanner(true);
    setShowManualEntry(false);
  };

  const handleScanImage = () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        scanImageForQRCode(file);
      }
    };
    input.click();
  };

  const scanImageForQRCode = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const qrCodeInstance = html5QrCode || new Html5Qrcode("qr-reader");
      const imageFile = file;
      
      try {
        const decodedText = await qrCodeInstance.scanFile(imageFile, true);
        
        // Search for user with scanned wallet address
        const results = await searchUsers(decodedText);
        if (!results || results.length === 0) {
          setError('No user found with this wallet address');
          return;
        }
        
        // Check if trying to add yourself
        if (results[0].id === user?.id) {
          setError('Cannot add yourself as a contact');
          return;
        }
        
        // Add contact
        await addContact(results[0].id);
        setSuccessMessage(`Successfully added ${results[0].username || 'contact'} to your contacts!`);
        
        // Clear form after 1.5s
        setTimeout(() => {
          setSearchQuery('');
          setSuccessMessage(null);
        }, 1500);
        
      } catch (error) {
        setError('Could not detect a valid QR code in the image');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterAddress = () => {
    setShowManualEntry(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    await addContactByWalletAddress(manualAddress.trim());
  };

  const handleAddContact = async (address: string) => {
    await addContactByWalletAddress(address);
  };

  const startScanner = async () => {
    try {
      setShowScanner(true);
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await scanner.stop();
          setShowScanner(false);
          handleAddContact(decodedText);
        },
        (errorMessage) => {
          console.log(errorMessage);
        }
      );
    } catch (err) {
      console.error(err);
      setShowScanner(false);
      setError("Failed to start camera");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const scanner = new Html5Qrcode("reader");
      const imageFile = file;
      const decodedText = await scanner.scanFile(imageFile, true);
      handleAddContact(decodedText);
    } catch (error) {
      setError('Failed to scan QR code from image');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualEntry = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    await addContactByWalletAddress(searchQuery.trim());
  };

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

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900 natural-dark:bg-natural-dark-background">
      {/* Header */}
      <div className="bg-brand-primary natural-light:bg-natural-primary natural-dark:bg-natural-dark-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiQrcode size={24} />
          </div>
          <div>
            <div className="font-semibold">Connect</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Connection Options */}
        <div className="max-w-full bg-white dark:bg-gray-800 natural-dark:bg-natural-dark-paper shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            {/* QR Code Panel */}
            <div className="mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white natural-dark:text-natural-dark-text mb-4">Share Your Profile</h3>
              
              <div className="bg-gray-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border rounded-lg p-4">
                <div className="flex flex-col sm:flex-row items-center">
                  {/* QR Code */}
                  <div className="bg-white p-3 rounded-lg mb-4 sm:mb-0 sm:mr-6" id="qr-code">
                    <QRCodeSVG
                      value={profile?.wallet_address || ''}
                      size={250}
                      bgColor={"#ffffff"}
                      fgColor={"#000000"}
                      level={"L"}
                      includeMargin={false}
                    />
                  </div>
                  
                  {/* Wallet Address & Actions */}
                  <div className="flex-1 w-full">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 natural-dark:text-natural-dark-text mb-1">
                        Your XRP Address
                      </label>
                      <div className="flex items-center bg-gray-100 dark:bg-gray-600 natural-dark:bg-white/70 p-2 rounded">
                        <div className="flex-1 text-sm text-gray-800 dark:text-gray-200 natural-dark:text-natural-dark-text font-mono truncate">
                          {profile?.wallet_address}
                        </div>
                        <CopyButton 
                          text={profile?.wallet_address || ''} 
                          className="ml-2 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        />
                      </div>
                      {profile?.wallet_address && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                            Valid XRP Address
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 justify-center">
                      {canShare && (
                        <button
                          onClick={shareQRCode}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                        >
                          <HiShare className="-ml-0.5 mr-2 h-4 w-4" />
                          Share
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Scan QR Code Section */}
            <div className="mt-10">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white natural-dark:text-natural-dark-text mb-4">Scan or Enter Address</h3>
              
              {!showScanner && !showManualEntry && (
                <div className="bg-gray-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border rounded-lg p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={handleScanClick}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 natural-dark:border-natural-dark-border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 natural-dark:hover:bg-natural-dark-border/80 transition-colors"
                    >
                      <HiCamera className="h-8 w-8 text-brand-primary natural-dark:text-natural-dark-primary mb-2" />
                      <span className="text-gray-700 dark:text-gray-300 natural-dark:text-natural-dark-text font-medium">
                        Scan QR Code
                      </span>
                    </button>

                    <button
                      onClick={handleScanImage}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 natural-dark:border-natural-dark-border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 natural-dark:hover:bg-natural-dark-border/80 transition-colors"
                    >
                      <HiPhotograph className="h-8 w-8 text-brand-primary natural-dark:text-natural-dark-primary mb-2" />
                      <span className="text-gray-700 dark:text-gray-300 natural-dark:text-natural-dark-text font-medium">
                        Upload QR Image
                      </span>
                    </button>

                    <button
                      onClick={handleManualEntry}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 natural-dark:border-natural-dark-border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 natural-dark:hover:bg-natural-dark-border/80 transition-colors"
                    >
                      <HiClipboard className="h-8 w-8 text-brand-primary natural-dark:text-natural-dark-primary mb-2" />
                      <span className="text-gray-700 dark:text-gray-300 natural-dark:text-natural-dark-text font-medium">
                        Enter Address
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* QR Scanner */}
              {showScanner && (
                <div className="bg-gray-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border rounded-lg p-4">
                  <div className="flex flex-col items-center">
                    <div id="qr-reader" className="w-full max-w-lg mx-auto"></div>
                    
                    {loading && (
                      <div className="mt-4 flex flex-col items-center">
                        <div className="animate-pulse rounded-full bg-gray-300 h-8 w-8 mb-2"></div>
                        <p className="text-gray-600 dark:text-gray-400">Processing...</p>
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowScanner(false)}
                      className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <HiX className="-ml-0.5 mr-2 h-4 w-4" /> Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Manual Address Entry */}
              {showManualEntry && (
                <div className="bg-gray-50 dark:bg-gray-700 natural-dark:bg-natural-dark-border rounded-lg p-4">
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 natural-dark:text-natural-dark-text mb-1">
                        XRP Wallet Address
                      </label>
                      <input
                        type="text"
                        id="wallet-address"
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        placeholder="Enter wallet address"
                        className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 natural-dark:bg-white/70 dark:text-white natural-dark:text-natural-dark-text rounded-md"
                      />
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={loading || !manualAddress.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary natural-dark:bg-natural-dark-primary hover:bg-brand-secondary natural-dark:hover:bg-natural-dark-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50"
                      >
                        {loading ? 'Adding...' : 'Add Contact'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setShowManualEntry(false)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 natural-dark:border-natural-dark-border shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 natural-dark:text-natural-dark-text bg-white dark:bg-gray-800 natural-dark:bg-natural-dark-paper hover:bg-gray-50 dark:hover:bg-gray-700 natural-dark:hover:bg-natural-dark-border/50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {/* Error or Success Messages */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 natural-dark:bg-red-100/20 text-red-700 dark:text-red-400 natural-dark:text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              {successMessage && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 natural-light:bg-natural-button-active-bg/30 natural-dark:bg-natural-button-active-bg-dark/30 text-green-700 dark:text-green-400 natural-light:text-natural-primary natural-dark:text-natural-dark-text rounded-md">
                  {successMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* File Input for Image Scanning */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}; 