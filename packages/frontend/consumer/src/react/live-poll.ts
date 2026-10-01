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
 * - `sessionStarting`: the session list, where a row is still being built or a
 *   deleted row stays `open` until its host answers the close (watched for at
 *   most {@link CLOSE_WATCH_MS}). One pace: the list is a sidebar, not the
 *   thing a reader is waiting on.
 * - `sessionOpening`: **one** session's own row, while it is starting. It is
 *   the only poll with an `opening` phase, because it is the only one someone
 *   is watching. A host builds the terminal *before* it clones, so the answer
 *   is usually there within a second, and asking every two seconds spent most
 *   of that second waiting for a tick with a stepper drawn over a pane that was
 *   already live. After `openingForMs` what is left is a clone, or a restart a
 *   host may answer only when it is back, and two seconds is pace enough.
 *
 *   The opening phase belongs here and not on the list because its clock is
 *   kept per query, and the list is **one** query for every session: a second
 *   session started while the first was still cloning would inherit the first
 *   one's settled tick. A detail query is per session, so each gets its own.
 * - `pairing`: whether a pairing token has been spent and its machine is online.
 * - `liveRun`: an automation run, queued for seconds and running for minutes.
 * - `hostPresence`: a host going on or offline (Settings → Hosts).
 */
export const LIVE_POLL = {
  sessionStarting: { interval: 2000, inBackground: true },
  sessionOpening: {
    interval: 2000,
    openingInterval: 300,
    openingForMs: 3000,
    inBackground: true,
  },
  pairing: { interval: 3000, inBackground: true },
  liveRun: { interval: 5000, inBackground: true },
  hostPresence: { interval: 15_000, inBackground: false },
} as const;

export type LivePollKind = keyof typeof LIVE_POLL;

/** The two TanStack options a poll is, so a hook can leave them out of what it accepts. */
export type PollKeys = 'refetchInterval' | 'refetchIntervalInBackground';

export interface Poll<TData> {
  refetchInterval: number | false | ((query: PollQuery<TData>) => number | false);
  refetchIntervalInBackground: boolean;
}

/** What {@link pollWhile} reads off the query TanStack hands its interval callback. */
interface PollQuery<TData> {
  queryHash: string;
  state: { data?: TData };
}

/**
 * When each polling query started asking, so a poll with an `opening` phase
 * knows whether it is still in it. Keyed by the query's hash and dropped the
 * moment that query stops polling, which is also what makes a later start —
 * a second session, a restart — open fast again rather than inherit the first
 * one's clock.
 */
const askingSince = new Map<string, number>();

/** The interval this tick, for a poll that opens faster than it settles. */
function intervalFor(kind: LivePollKind, queryHash: string): number {
  const poll = LIVE_POLL[kind];
  if (!('openingInterval' in poll)) return poll.interval;
  const now = Date.now();
  let began = askingSince.get(queryHash);
  if (began === undefined) {
    began = now;
    askingSince.set(queryHash, began);
  }
  return now - began < poll.openingForMs ? poll.openingInterval : poll.interval;
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
  const poll = LIVE_POLL[kind];
  const { inBackground } = poll;
  const opens = 'openingInterval' in poll;
  // A poll with no opening phase stays a number, which is what it means: one
  // pace, whoever asks.
  const paced = (query: PollQuery<TData>) =>
    opens ? intervalFor(kind, query.queryHash) : poll.interval;
  return {
    refetchInterval:
      typeof active === 'function'
        ? (query) => {
            if (!active(query.state.data)) {
              // Settled: forget when it started, so the next thing this query
              // waits on opens fast rather than continuing an old clock.
              if (opens) askingSince.delete(query.queryHash);
              return false;
            }
            return paced(query);
          }
        : active
          ? opens
            ? paced
            : poll.interval
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
