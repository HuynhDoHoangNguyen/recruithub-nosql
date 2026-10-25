import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  const root = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  const backend = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '')
  const local = loadEnv(mode, process.cwd(), 'VITE_')
  const backendPort = process.env.PORT || backend.PORT || root.PORT || '5000'

  return {
    cacheDir: 'node_modules/.vite/portal-dev',
    plugins: [react()],
    optimizeDeps: { include: ['lucide-react'] },
    server: {
      host: '127.0.0.1',
      port: 5177,
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
