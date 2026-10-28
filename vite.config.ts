import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const proxy = {
  '/api/openai': {
    target: 'https://api.openai.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/openai/, '/v1'),
  },
  '/api/opencode': {
    target: 'https://opencode.ai/zen',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/opencode/, '/v1'),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
