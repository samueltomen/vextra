import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
    warmup: {
      clientFiles: ['./src/main.tsx', './src/routes/**/*.tsx'],
    },
  },
  build: {
    sourcemap: false,
  },
})
