/**
 * Every poll the console runs against the API: how often it asks, and whether
 * it keeps asking while the tab is hidden. A query hook in this package spreads
 * {@link pollWhile}; nothing else names an interval, and a feature asks for the
 * hook that already polls (`useHostPresence`). Each poll goes when the console
 * streams that fact instead.
 *
 * `inBackground` keeps TanStack Query's interval running on a hidden document,
 * where it pauses by default. A poll that watches something finish keeps going:
 * the reader leaves the tab while it runs, and each stops once the thing
 * settles. Presence never settles, so it pauses.
 *
 * - `sessionStarting`: a session a host is still building, or one the caller
 *   deleted whose row stays `open` until its host answers the close (watched
 *   for at most {@link CLOSE_WATCH_MS}). A clone from GitHub takes seconds;
 *   past that, a request every two seconds can only answer "still open".
 * - `pairing`: whether a pairing token has been spent and its machine is online.
 * - `liveRun`: an automation run, queued for seconds and running for minutes.
 * - `hostPresence`: a host going on or offline (Settings → Hosts).
 */
export const LIVE_POLL = {
  sessionStarting: { interval: 2000, inBackground: true },
  pairing: { interval: 3000, inBackground: true },
  liveRun: { interval: 5000, inBackground: true },
  hostPresence: { interval: 15_000, inBackground: false },
} as const;

export type LivePollKind = keyof typeof LIVE_POLL;

/** The two TanStack options a poll is, so a hook can leave them out of what it accepts. */
export type PollKeys = 'refetchInterval' | 'refetchIntervalInBackground';

export interface Poll<TData> {
  refetchInterval: number | false | ((query: { state: { data?: TData } }) => number | false);
  refetchIntervalInBackground: boolean;
}

/**
 * The options that make a query poll as `kind` says, while `active` holds:
 * `true` for as long as the query is mounted, or a predicate over the rows the
 * query holds that says whether the thing is still moving.
 *
 * Spread it after the caller's options, so the catalog decides and a caller
 * cannot hand a different interval or turn the hidden-tab bit off.
 */
export function pollWhile<TData>(
  kind: LivePollKind,
  active: boolean | ((data: TData | undefined) => boolean),
): Poll<TData> {
  const { interval, inBackground } = LIVE_POLL[kind];
  return {
    refetchInterval:
      typeof active === 'function'
        ? (query) => (active(query.state.data) ? interval : false)
        : active
          ? interval
          : false,
    refetchIntervalInBackground: inBackground,
  };
}

/**
 * How long the session list keeps watching a deleted session's row. A host
 * that is online answers a close in seconds; one that is offline answers only
 * when it is back, and the list stops asking after this.
 */
export const CLOSE_WATCH_MS = 60_000;
