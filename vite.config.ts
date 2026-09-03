import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    /*
     * In development the frontend and API run as separate processes, so /api
     * is proxied to the server. This keeps requests same-origin, which is
     * what lets the httpOnly session cookie be sent at all. In production one
     * process serves both and no proxy is involved.
     */
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
});
