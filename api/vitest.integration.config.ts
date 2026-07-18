import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Separate Vitest process for Postgres smoke tests (Testcontainers).
 * Do not mix with unit tests — PrismaClient binds DATABASE_URL at import time.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist'],
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
