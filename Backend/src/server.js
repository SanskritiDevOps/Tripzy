import http from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma } from './config/prisma.js'
import { createSocketServer } from './realtime/socket.js'

const app = createApp()
const server = http.createServer(app)
// Live trip updates share the HTTP port (path /socket.io).
const io = await createSocketServer(server)

server.listen(env.PORT, () => {
  logger.info(`Tripzy API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`)
  // io.close() disconnects every socket and then closes the HTTP server.
  io.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  // Don't hang forever on open keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'))
