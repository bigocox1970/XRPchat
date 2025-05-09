import React, { useState, useRef, useEffect } from 'react';
import { HiLockClosed } from 'react-icons/hi';
import { useEncryption } from '../context/EncryptionContext';

interface PINEntryModalProps {
  onClose: () => void;
}

export const PINEntryModal: React.FC<PINEntryModalProps> = ({ onClose }) => {
  const { enterPIN } = useEncryption();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Auto-focus PIN input when modal opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Add escape key handler to close modal
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    // Add enter key handler to submit form when focused on input
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (formRef.current) {
          handleSubmit(new Event('submit') as any);
        }
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('keydown', handleEnter);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('keydown', handleEnter);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate PIN format
      if (!/^\d{6}$/.test(pin)) {
        setError('PIN must be exactly 6 digits');
        setIsSubmitting(false);
        return;
      }

      // Try to unlock with PIN
      const success = await enterPIN(pin);
      
      if (success) {
        // Set private key as available in localStorage
        localStorage.setItem('xrpchat_private_key_available', 'true');
        onClose();
      } else {
        setError('Incorrect PIN, please try again');
        setPin('');
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify PIN');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>

        {/* Modal */}
        <div 
          className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-headline"
        >
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-50 dark:bg-brand-900">
              <HiLockClosed className="h-6 w-6 text-brand-primary" aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-headline">
                PIN Required
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter your 6-digit PIN to decrypt your private key and read messages.
                </p>
              </div>
            </div>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-5 sm:grid sm:grid-cols-2 sm:gap-3">
            <div className="col-span-2 mb-4">
              <label htmlFor="pin" className="sr-only">PIN</label>
              <input
                id="pin"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="shadow-sm focus:ring-brand-primary focus:border-brand-primary block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-4 py-2"
                required
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="col-span-2 mb-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand-primary text-base font-medium text-white hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 sm:col-start-2 sm:text-sm"
            >
              {isSubmitting ? 'Verifying...' : 'Unlock'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary dark:focus:ring-offset-gray-800 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}; 