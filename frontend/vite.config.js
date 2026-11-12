import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  const frontendDir = fileURLToPath(new URL('.', import.meta.url))
  const root = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  const backend = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '')
  const local = loadEnv(mode, frontendDir, 'VITE_')
  // VITE_API_PROXY_TARGET overrides the backend PORT from root/backend env.
  const backendPort = backend.PORT || root.PORT || '5000'

  return {
    envDir: frontendDir,
    cacheDir: 'node_modules/.vite/portal-dev',
    plugins: [react()],
    optimizeDeps: { include: ['lucide-react'] },
    server: {
      host: '127.0.0.1',
      port: 5178,
      strictPort: true,
      proxy: {
        '/api': {
          target: local.VITE_API_PROXY_TARGET || `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
