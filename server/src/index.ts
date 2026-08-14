import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { config } from './config.ts'
import './db.ts'
import { routes } from './routes.ts'
import { startScheduler, stopScheduler } from './scheduler.ts'
import { sweep } from './retention.ts'
import { closeBrowser } from './render.ts'

const here = dirname(fileURLToPath(import.meta.url))
const webDist = join(here, '../../web/dist')

const app = Fastify({
  logger: { level: process.env.ARGUS_LOG ?? 'info' },
  bodyLimit: 2 * 1024 * 1024,
})

routes(app)

if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist })
  // SPA fallback: anything not under /api is the client router's problem.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' })
    // The shell must never be cached: its asset hashes change on every build,
    // and a stale index.html points at bundles that no longer exist.
    return reply.header('cache-control', 'no-cache').sendFile('index.html')
  })
} else {
  app.log.warn(`web/dist missing at ${webDist} — API only. Run: pnpm build`)
}

await app.listen({ port: config.port, host: config.host })
startScheduler()

const sweepTimer = setInterval(sweep, 60 * 60 * 1000)

const shutdown = async () => {
  clearInterval(sweepTimer)
  stopScheduler()
  await closeBrowser()
  await app.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
