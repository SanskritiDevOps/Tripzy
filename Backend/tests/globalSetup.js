import 'dotenv/config'
import { execSync } from 'node:child_process'

/** Brings the test database schema up to date before any test runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL must be set to run the tests')
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' })
}
