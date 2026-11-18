import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev server 把 /api 代理到后端 3001，避免跨域配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
