import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.ts'],
      // node.ts only wires I/O (HTTP server, sockets, timers) around tested units.
      exclude: ['src/**/*.test.ts', 'src/node.ts'],
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
