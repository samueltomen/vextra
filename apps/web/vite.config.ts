import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { defineConfig, type Plugin } from 'vite'

import { buildStaticHeaders } from './build/static-headers.ts'

/** Emits the Cloudflare `_headers` file next to the built SPA. */
function staticHeadersPlugin(): Plugin {
  let outDir = 'dist'

  return {
    apply: 'build',
    closeBundle() {
      const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8')

      writeFileSync(join(outDir, '_headers'), buildStaticHeaders(indexHtml))
    },
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    name: 'vextra-static-headers',
  }
}

const apiTarget = process.env.VEXTRA_API_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      target: 'react',
    }),
    react(),
    tailwindcss(),
    staticHeadersPlugin(),
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
