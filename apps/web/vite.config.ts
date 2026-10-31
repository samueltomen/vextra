import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from 'vite'

const apiTarget = process.env.CRONPING_API_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      target: 'react',
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
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
