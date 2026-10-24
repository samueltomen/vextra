import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from 'vite'

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
