import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Tests never reach real services, whatever is in .env: no emails (mailer logs instead),
    // no Gemini or map calls (those tests stub fetch).
    env: { NODE_ENV: 'test', GEOCODER_URL: '', SMTP_URL: '', BREVO_API_KEY: '', GEMINI_API_KEY: '' },
    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setup.js'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
})
