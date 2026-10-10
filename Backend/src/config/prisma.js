import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { env } from './env.js'

// One client (and connection pool) per process.
const adapter = new PrismaPg({ connectionString: env.databaseUrl })

export const prisma = new PrismaClient({ adapter })
