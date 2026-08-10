import { homedir } from 'node:os'
import { join } from 'node:path'

const env = process.env
const dataDir = env.ARGUS_DATA ?? join(homedir(), '.local/share/argus')

export const config = {
  port: Number(env.ARGUS_PORT ?? 8797),
  host: env.ARGUS_HOST ?? '0.0.0.0',
  /** Public base URL, used in notification links. */
  baseUrl: (env.ARGUS_BASE_URL ?? 'http://localhost:8797').replace(/\/$/, ''),
  dataDir,
  dbPath: env.ARGUS_DB ?? join(dataDir, 'argus.db'),
  snapDir: join(dataDir, 'snapshots'),
  /** Max checks running at once. */
  concurrency: Number(env.ARGUS_CONCURRENCY ?? 3),
  /** Minimum gap between two checks hitting the same host, ms. */
  hostGapMs: Number(env.ARGUS_HOST_GAP_MS ?? 5000),
  fetchTimeoutMs: Number(env.ARGUS_FETCH_TIMEOUT_MS ?? 30_000),
  userAgent:
    env.ARGUS_UA ??
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  /** System Chrome/Chromium — argus drives an existing browser rather than downloading one. */
  chromePath: env.ARGUS_CHROME ?? '/usr/bin/google-chrome-stable',
  /** Optional CDP endpoint of an already-running Chrome, for watches needing a logged-in session. */
  cdpUrl: env.ARGUS_CDP ?? '',
  viewport: {
    width: Number(env.ARGUS_VIEWPORT_W ?? 1440),
    height: Number(env.ARGUS_VIEWPORT_H ?? 900),
  },
  /** Retention: unchanged checks kept per watch; changed checks kept per watch. */
  retainUnchanged: Number(env.ARGUS_RETAIN_UNCHANGED ?? 5),
  retainChanged: Number(env.ARGUS_RETAIN_CHANGED ?? 100),
  /** Hard cap on snapshot bytes per watch. */
  watchByteCap: Number(env.ARGUS_WATCH_BYTE_CAP ?? 200 * 1024 * 1024),
}
