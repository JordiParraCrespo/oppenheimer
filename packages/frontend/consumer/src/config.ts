/**
 * The console's tunables: the decisions about time and paging the product
 * package and the console make. The generic ones (query freshness, clock
 * ticks, retries) are the kernel's `CORE_CONFIG`; every poll is `LIVE_POLL`
 * (`src/react/live-poll.ts`), the catalog `pollWhile()` reads. Units, protocol
 * facts and small single-use values stay where they are used.
 */
export const CONSUMER_CONFIG = {
  sessions: {
    /** Entries per page of a session's start log. */
    startLogPageSize: 50,
    /** How many pages of start log a start may span before the reader stops asking. */
    maxStartLogPages: 20,
  },
  /** The terminal's link to the host (`product/versions/mvp/01-protocol.md`). */
  stream: {
    /** The delays between reconnect attempts, with jitter on top (`product/12-lessons-from-grok-bot.md`). */
    reconnectLadderMs: [500, 1_000, 2_000, 5_000, 10_000, 30_000],
  },
  /** The live stream (`product/versions/mvp/21-live-events.md`). */
  live: {
    /**
     * How long to wait before dialling again once the API refused the stream
     * (signed out, the flag off, its bus down). The console polls meanwhile,
     * so this only decides how soon pushing comes back.
     */
    redialAfterRefusalMs: 60_000,
  },
  automations: {
    /** How long a GitHub trigger's "would have matched" preview stays fresh. */
    triggerPreviewStaleMs: 30_000,
  },
  permissions: {
    /** How long the permission catalog stays fresh: it only changes when someone's roles change. */
    catalogStaleMs: 5 * 60_000,
  },
  organizations: {
    /**
     * How long the workspace-address field waits after a keystroke before it
     * asks the API, so a word costs one request rather than one per letter.
     */
    addressCheckDebounceMs: 400,
    /**
     * How long an address-availability answer is kept once nothing reads it.
     * Never fresh (an address is free until somebody takes it); kept only so
     * typing back to a word just checked does not flash.
     */
    slugCheckGcMs: 30_000,
  },
} as const;
