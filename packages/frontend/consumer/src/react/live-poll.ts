/**
 * Every interval at which the console asks the API again, in one place and
 * read only by this package's query hooks: a feature never sets
 * `refetchInterval`. All but presence poll only while the thing they watch is
 * moving — the hooks return `false` once it settles; presence polls while a
 * view that shows it is mounted (`useHostPresence`). Each goes when the
 * console streams that fact instead.
 *
 * A poll that watches something finish also runs while the tab is hidden
 * (`refetchIntervalInBackground: true`): a session start takes the best part
 * of a minute, and the tab it was launched from is the one a person leaves
 * while it runs. Without the flag TanStack Query pauses the interval on a
 * hidden document, and the pane came back frozen on a step that had finished
 * (#111). Each of these polls stops on its own once the thing settles, so the
 * flag buys a minute or two of requests and nothing after it. Presence is the
 * one poll that never settles, so it stays foreground-only, and says so.
 * `pnpm check:structure` fails a `refetchInterval` in this package's React
 * layer that does not decide `refetchIntervalInBackground` beside it.
 *
 * - `sessionStarting`: a session a host is still building. A clone from GitHub
 *   takes seconds; past that, a request every two seconds can only answer
 *   "still open".
 * - `sessionClosing`: a session the caller deleted, whose row stays `open`
 *   until its host answers the close. Watched for at most `CLOSE_WATCH_MS`.
 * - `pairing`: whether a pairing token has been spent, and whether the machine
 *   that spent it is online yet.
 * - `liveRun`: an automation run, queued for seconds and running for minutes.
 * - `hostPresence`: a host going on or offline, for a view that shows it
 *   (Settings → Hosts). A heartbeat is not streamed to the console yet.
 */
export const LIVE_POLL = {
  sessionStarting: 2000,
  sessionClosing: 2000,
  pairing: 3000,
  liveRun: 5000,
  hostPresence: 15_000,
} as const;

/**
 * How long the session list keeps watching a deleted session's row. A host
 * that is online answers a close in seconds; one that is offline answers only
 * when it is back, and the list stops asking after this.
 */
export const CLOSE_WATCH_MS = 60_000;
