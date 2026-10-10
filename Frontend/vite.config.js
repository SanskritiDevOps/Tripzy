import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Same-origin /api in development, so the refresh-token cookie is first-party.
      proxy: {
        '/api': { target: env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: true },
      },
    },
  }
})
