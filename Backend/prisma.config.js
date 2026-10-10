import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types --disable-warning=ExperimentalWarning prisma/seed.js',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
