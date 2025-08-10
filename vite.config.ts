import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        // This will prevent dynamic code evaluation
        parserOpts: {
          strictMode: true
        }
      }
    }),
    {
      name: 'rewrite-all',
      configureServer(server) {
        return () => {
          server.middlewares.use((req, _, next) => {
            if (!req.url?.includes('.')) {
              req.url = '/index.html';
            }
            next();
          });
        };
      }
    }
  ],
  base: '/',
  server: {
    port: 3000,
    strictPort: false,
    headers: {
      // Set CSP headers
      'Content-Security-Policy': `
        default-src 'self';
        connect-src 'self' https://*.supabase.co wss://*.supabase.co:* wss://aoqvffeqscehfnrjgjrs.supabase.co wss://s.altnet.rippletest.net:51233 http://localhost:* ws://localhost:* https://*.ngrok-free.app wss://*.ngrok-free.app https://relay.peer.ooo:8765 wss://relay.peer.ooo:8765;
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline';
        font-src 'self' data:;
        img-src 'self' data: blob: https://*.supabase.co https://api.dicebear.com;
        manifest-src 'self';
        worker-src 'self' blob:
      `.replace(/\s+/g, ' ').trim()
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Ensure consistent chunk names for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'xrpl-vendor': ['xrpl']
        }
      }
    }
  }
});
