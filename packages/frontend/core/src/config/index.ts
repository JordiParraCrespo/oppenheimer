/**
 * The kernel's tunables: every timing and limit the frontend holds that is not
 * about one product, in one place. A package or an app reads a value from here
 * rather than writing the number where it is used, so changing how often a
 * clock ticks or how long a search waits is one edit, and a reader can see
 * every knob the client has without grepping for `60_000`.
 *
 * What belongs here is generic: the query cache, the clock ticks the console
 * draws times on, how long input waits before it asks, how long a
 * confirmation stays up. A tunable that is about the product (a poll, the
 * terminal stream, a page size) is the product package's
 * (`CONSUMER_CONFIG` in `@oppenheimer/frontend-consumer/config`), because the
 * kernel never names a product.
 *
 * What does not belong anywhere like this: unit constants (`MINUTE`, `DAY`),
 * protocol facts (escape codes, close codes, `setTimeout`'s ceiling) and cache
 * revisions. Those are not choices; changing one is a bug.
 */
export const CORE_CONFIG = {
  query: {
    /**
     * How long a query's data counts as fresh before a mount or a focus
     * refetches it. The default for every query; a hook that needs another
     * lifetime says so itself.
     */
    staleTimeMs: 60_000,
    /**
     * How long a restored cache entry stays usable before the persister throws
     * it away, so a user who comes back after a week never sees week-old data
     * flash on screen.
     */
    persistMaxAgeMs: 24 * 60 * 60 * 1000,
  },
  /**
   * The clocks a time on screen ticks on (`useNow(interval)`). Pick the one
   * that matches what the text shows: a clock finer than the text is a render
   * for a number that did not change.
   */
  clock: {
    /** For a running clock in seconds: the provisioning pane's elapsed time. */
    secondMs: 1_000,
    /** For "in 3 minutes" next to a schedule, which has to turn over on time. */
    halfMinuteMs: 30_000,
    /** For anything worded in minutes: ages, "2 hours ago", group headers. */
    minuteMs: 60_000,
  },
  input: {
    /** How long a search field waits after the last keystroke before it filters. */
    searchDebounceMs: 300,
    /**
     * How long a field that asks the API whether a value is free (a workspace
     * address) waits, so a word costs one request rather than one per letter.
     */
    availabilityCheckDebounceMs: 400,
  },
  feedback: {
    /** How long a "Copied" confirmation stays up after a copy. */
    copiedMs: 1_800,
  },
} as const;
