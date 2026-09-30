/**
 * Every poll the console runs against the API, in one place: how often it
 * asks, and whether it keeps asking while the tab is hidden. A query hook in
 * this package spreads {@link pollWhile}; nothing else names an interval, and a
 * feature asks for the hook that already polls (`useHostPresence`). Each poll
 * goes when the console streams that fact instead.
 *
 * `inBackground` is whether TanStack Query keeps the interval running on a
 * hidden document, which it pauses by default. A poll that watches something
 * finish keeps going: the tab a session was started from is the one the
 * reader leaves while it runs, and each of these stops on its own once the
 * thing settles. Presence never settles, so it pauses.
 *
 * - `sessionStarting`: a session a host is still building, and one the caller
 *   deleted whose row stays `open` until its host answers the close (watched
 *   for at most {@link CLOSE_WATCH_MS}). A clone from GitHub takes seconds;
 *   past that, a request every two seconds can only answer "still open".
 * - `pairing`: whether a pairing token has been spent, and whether the machine
 *   that spent it is online yet.
 * - `liveRun`: an automation run, queued for seconds and running for minutes.
 * - `hostPresence`: a host going on or offline, for a view that shows it
 *   (Settings → Hosts). A heartbeat is not streamed to the console yet.
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

/** What {@link pollWhile} returns: the query options that make a hook poll. */
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

/**
 * How long a session's detail keeps watching a restart it asked for.
 *
 * A restart records a request, not an outcome: the row stays stopped until the
 * host says it brought the terminal back, which is a clone-free relaunch and
 * takes seconds. Without the watch the pane sits on "the turn has ended" until
 * something else refetches, which is a reload the reader should not have to
 * think of. A host that is offline never answers, and the watch stops asking.
 */
export const RESTART_WATCH_MS = 60_000;
