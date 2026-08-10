/**
 * A check killed by our own shutdown is not a site failure. Without this, every
 * redeploy records errors against whatever was in flight, inflates the watch's
 * failure count and pushes its next run out by the backoff.
 *
 * Lives alone so `check` and `scheduler` can both read it without importing
 * each other.
 */
let shuttingDown = false

export const isShuttingDown = () => shuttingDown
export const beginShutdown = () => {
  shuttingDown = true
}
