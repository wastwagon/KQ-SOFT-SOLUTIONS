import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:9001'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brs/suggested-mapping': path.resolve(__dirname, '../api/src/services/suggestedMapping.ts'),
    },
  },
  server: {
    port: 9100,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
