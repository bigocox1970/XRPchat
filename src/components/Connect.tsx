import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { HiQrcode, HiCamera, HiClipboard, HiDownload, HiShare, HiX, HiPhotograph, HiPlus } from 'react-icons/hi';
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

  const handleDownloadQR = () => {
    const canvas = document.querySelector('#qr-code canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'xrpchat-qr.png';
      link.href = canvas.toDataURL();
      link.click();
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
    <div className="h-full flex flex-col bg-[#f0f2f5] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-brand-primary text-white px-4 py-[16px] flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <HiQrcode size={24} />
          </div>
          <div>
            <div className="font-semibold">Connect</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-8">
          {/* Share QR Code Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Share Your QR Code
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Let others scan this QR code to add you as a contact and start chatting!
            </p>
            
            <div className="flex flex-col items-center space-y-6">
              {/* QR Code */}
              <div id="qr-code" className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={profile?.wallet_address || ''} size={200} />
              </div>
              
              {/* Wallet Address */}
              <div className="w-full">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Your Wallet Address:
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg text-gray-900 dark:text-gray-100 font-mono text-sm break-all">
                    {profile?.wallet_address || 'No wallet address available'}
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                    title="Copy Address"
                  >
                    <HiClipboard size={20} />
                  </button>
                </div>
                {copied && (
                  <div className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Address copied to clipboard!
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-4">
                {canShare && (
                  <button
                    onClick={shareQRCode}
                    className="flex items-center space-x-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
                    disabled={!profile?.wallet_address}
                  >
                    <HiShare size={20} />
                    <span>Share</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Add Contact Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Add Contact
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Choose how you want to add a new contact
            </p>
            
            {!showManualEntry && !showScanner ? (
              <div className="grid grid-cols-3 gap-4">
                {/* Scan with Camera */}
                <button
                  onClick={handleScanClick}
                  className="flex flex-col items-center justify-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Scan with Camera</span>
                </button>

                {/* Scan Image */}
                <button
                  onClick={() => {
                    // Hide QR reader if it's visible
                    if (showQrReader) {
                      setShowQrReader(false);
                      if (html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().catch(console.error);
                      }
                    }
                    setShowManualEntry(false);
                    
                    // Handle image selection
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      if (target && target.files && target.files[0]) {
                        console.log('Image selected:', target.files[0]);
                        // Actually scan the image for QR code
                        scanImageForQRCode(target.files[0]);
                      }
                    };
                    input.click();
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Scan Image</span>
                </button>

                {/* Enter Wallet Address */}
                <button
                  onClick={() => {
                    // Hide QR reader if it's visible
                    if (showQrReader) {
                      setShowQrReader(false);
                      if (html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().catch(console.error);
                      }
                    }
                    // Show input field
                    setShowManualEntry(true);
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Enter Wallet Address</span>
                </button>
              </div>
            ) : showScanner ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Scan QR Code
                  </h4>
                  <button
                    onClick={() => {
                      setShowScanner(false);
                      if (html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().catch(err => console.error('Error stopping camera:', err));
                      }
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-200"
                  >
                    Back
                  </button>
                </div>
                
                <div id="qr-reader" className="w-full aspect-square max-w-md mx-auto bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"></div>
                
                {loading && (
                  <div className="flex justify-center items-center py-4">
                    <svg className="animate-spin h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Scanning...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter wallet address..."
                    className="focus:ring-brand-primary focus:border-brand-primary block w-full pl-4 pr-12 py-3 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm"
                  />
                  {searchQuery && (
                    <CopyButton 
                      text={searchQuery} 
                      size={5} 
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    />
                  )}
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={handleManualEntry}
                    disabled={loading || !searchQuery.trim()}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <HiPlus className="h-5 w-5" />
                    )}
                    <span>{loading ? 'Adding...' : 'Add Contact'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowManualEntry(false);
                      setSearchQuery('');
                      setError(null);
                    }}
                    className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Show only one error/success message section at the bottom */}
            {(error || successMessage) && (
              <div className="mt-4">
                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}
                {successMessage && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    {successMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 