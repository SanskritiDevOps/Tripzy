import { afterAll, beforeEach } from 'vitest'
import { prisma } from '../src/config/prisma.js'

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE trip_members, trips, refresh_tokens, users RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await prisma.$disconnect()
})
