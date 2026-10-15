import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiProxy = {
  '/api': { target: process.env.VITE_DEV_API || 'http://localhost:5000', changeOrigin: true },
  '/uploads': { target: process.env.VITE_DEV_API || 'http://localhost:5000', changeOrigin: true },
};

// In development the API runs on :5000; proxying keeps the app same-origin so the
// httpOnly auth cookie works without any CORS/cookie configuration.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    proxy: apiProxy,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'axios'] } },
    },
  },
});
