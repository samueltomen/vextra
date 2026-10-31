import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Parallel jsdom workers under coverage can exceed the 5 s default.
    testTimeout: 15_000,
    // Node >= 25 expose un localStorage natif qui masque celui de jsdom.
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      include: [
        'src/api/**/*.ts',
        'src/features/**/*.{ts,tsx}',
        'src/lib/**/*.ts',
        'src/shell/**/*.tsx',
      ],
      exclude: ['src/**/*.test.*', 'src/test/**'],
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
