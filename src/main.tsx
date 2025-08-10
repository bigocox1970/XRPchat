import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/*
// Register service worker for better caching and offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}
*/

// Hide loading skeleton once React starts rendering
const hideLoadingSkeletonAfterDelay = () => {
  setTimeout(() => {
    document.body.classList.add('app-loaded');
  }, 300); // Small delay to prevent flash
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide loading skeleton after React has mounted
hideLoadingSkeletonAfterDelay();
