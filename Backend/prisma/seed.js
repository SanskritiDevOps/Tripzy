// Creates the demo account used by the frontend's "Use demo account" button.
// Safe to run repeatedly. Never run against production.
import bcrypt from 'bcryptjs'
import { prisma } from '../src/config/prisma.js'
import { env } from '../src/config/env.js'

const DEMO = { name: 'Sanskriti Singh', email: 'demo@tripzy.app', password: 'tripzy-demo-123' }

if (env.isProduction) {
  console.error('Refusing to seed the demo account in production.')
  process.exit(1)
}

const passwordHash = await bcrypt.hash(DEMO.password, 12)
const user = await prisma.user.upsert({
  where: { email: DEMO.email },
  update: { name: DEMO.name, passwordHash },
  create: { name: DEMO.name, email: DEMO.email, passwordHash },
})
console.log(`Demo user ready: ${user.email} / ${DEMO.password}`)
await prisma.$disconnect()
