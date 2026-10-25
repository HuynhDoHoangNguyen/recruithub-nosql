import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  const backend = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '')
  const local = loadEnv(mode, process.cwd(), 'VITE_')
  return {
  // Keep the running portal's optimizer cache separate from test/reference servers.
  cacheDir: 'node_modules/.vite/portal-dev',
  plugins: [react()],
  optimizeDeps: { include: ['lucide-react'] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: local.VITE_API_PROXY_TARGET || `http://127.0.0.1:${process.env.PORT || backend.PORT || root.PORT || 5000}`,
        changeOrigin: true,
      },
    },
  },
  }
})
