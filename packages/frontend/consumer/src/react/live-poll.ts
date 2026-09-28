/**
 * Every interval at which the console asks the API again, in one place and
 * read only by this package's query hooks: a feature never sets
 * `refetchInterval`. The first three poll only while the thing they watch is
 * moving — the hooks return `false` once it settles; presence polls while a
 * view that shows it is mounted (`useHostPresence`). Each goes when the
 * console streams that fact instead.
 *
 * - `sessionStarting`: a session a host is still building. A clone from GitHub
 *   takes seconds; past that, a request every two seconds can only answer
 *   "still open".
 * - `pairing`: whether a pairing token has been spent, and whether the machine
 *   that spent it is online yet.
 * - `liveRun`: an automation run, queued for seconds and running for minutes.
 * - `hostPresence`: a host going on or offline, for a view that shows it
 *   (Settings → Hosts). A heartbeat is not streamed to the console yet.
 */
export const LIVE_POLL = {
  sessionStarting: 2000,
  pairing: 3000,
  liveRun: 5000,
  hostPresence: 15_000,
} as const;
