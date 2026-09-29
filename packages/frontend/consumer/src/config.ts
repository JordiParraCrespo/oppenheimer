/**
 * The console's tunables: every timing and limit the product package and the
 * console hold, in one place. A hook, a repository, the stream or a feature
 * reads a value from here rather than writing the number where it is used.
 * The generic ones (the query cache, clock ticks, input debounces) are the
 * kernel's `CORE_CONFIG` in `@oppenheimer/frontend-core/config`.
 */
export const CONSUMER_CONFIG = {
  /**
   * Every poll the console runs against the API: how often it asks, and
   * whether it keeps asking while the tab is hidden. `LIVE_POLL` in
   * `src/react/live-poll.ts` is this table and says why each entry is what it
   * is; only `pollWhile()` reads it.
   */
  poll: {
    sessionStarting: { interval: 2_000, inBackground: true },
    pairing: { interval: 3_000, inBackground: true },
    liveRun: { interval: 5_000, inBackground: true },
    hostPresence: { interval: 15_000, inBackground: false },
  },
  sessions: {
    /**
     * How long the session list keeps watching a deleted session's row. A host
     * that is online answers a close in seconds; one that is offline answers
     * only when it is back, and the list stops asking after this.
     */
    closeWatchMs: 60_000,
    /** The API's largest page (`PAGINATION.MAX_LIMIT`), so the whole list is as few requests as it can be. */
    listPageLimit: 100,
    /** Entries per page of a session's start log. */
    startLogPageSize: 50,
    /** How many pages of start log a start may span before the reader stops asking. */
    maxStartLogPages: 20,
  },
  /** The terminal's link to the host (`product/versions/mvp/01-protocol.md`). */
  stream: {
    /** The delays between reconnect attempts, with jitter on top (`12-lessons-from-grok-bot.md`). */
    reconnectLadderMs: [500, 1_000, 2_000, 5_000, 10_000, 30_000],
    /** How long a resize drag must be still before its size is sent to the PTY. */
    resizeSettleMs: 50,
    /**
     * The longest a hidden-cursor frame is held back waiting for the cursor to
     * come back, before what arrived is written anyway.
     */
    cursorFrameMaxMs: 100,
  },
  automations: {
    /** Runs per page of an automation's history. */
    runsPageSize: 10,
    /** How long a GitHub trigger's "would have matched" preview stays fresh. */
    triggerPreviewStaleMs: 30_000,
  },
  permissions: {
    /** How long the permission catalog stays fresh: it only changes when someone's roles change. */
    catalogStaleMs: 5 * 60 * 1000,
  },
  organizations: {
    /**
     * How long an address-availability answer is kept once nothing reads it.
     * Never fresh (an address is free until somebody takes it); kept only so
     * typing back to a word just checked does not flash.
     */
    slugCheckGcMs: 30_000,
  },
} as const;
