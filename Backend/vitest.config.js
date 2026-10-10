import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setup.js'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
})
