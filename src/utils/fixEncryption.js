/**
 * Run this script in your browser console to fix encryption settings
 * 
 * To use: 
 * 1. Open browser dev tools (F12)
 * 2. Copy this entire script
 * 3. Paste into Console tab and press Enter
 */

(function fixEncryptionSettings() {
  // Force decrypted view mode
  localStorage.setItem('xrpchat_show_encrypted', 'false');
  
  // Force private key as available if it was restored
  if (confirm('Have you restored your private key with your PIN?')) {
    localStorage.setItem('xrpchat_private_key_available', 'true');
  }
  
  // Reload the page to apply changes
  if (confirm('Settings updated. Reload page now?')) {
    window.location.reload();
  }
})(); 