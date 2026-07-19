import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
// Dev: proxy to http://localhost:8080 (dev profile = SSL disabled)
// Prod: nginx proxies to https://backend:8443 (see nginx.conf)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Dev profile keeps HTTP — prod nginx handles HTTPS upstream
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
