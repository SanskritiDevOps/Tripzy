import { afterAll, beforeEach } from 'vitest'
import { prisma } from '../src/config/prisma.js'

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE packing_items, settlements, expense_splits, expenses, itinerary_items, itinerary_days, votes, trip_activities, trip_invites, places, trip_members, trips, refresh_tokens, users RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await prisma.$disconnect()
})
