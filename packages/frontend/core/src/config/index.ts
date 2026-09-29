/**
 * The kernel's tunables: the decisions about time and retries that more than
 * one screen lives with — how long data stays fresh, how often a clock on
 * screen moves, how long a search waits, how many times a request is retried.
 * A package or an app reads the value from here rather than writing the number
 * where it is used, so changing one is one edit.
 *
 * A unit is not a decision: `MINUTE = 60_000` stays a constant where it is
 * used, and so do protocol facts (escape codes, close codes, `setTimeout`'s
 * ceiling, the API's page maximum) and small values with one reader that are
 * part of how that code works (a "Copied" flash, a resize settle). A decision
 * about the product (a poll, the terminal's reconnect ladder) is the product
 * package's `CONSUMER_CONFIG`, because the kernel never names a product.
 */
export const CORE_CONFIG = {
  query: {
    /**
     * How long a query's data counts as fresh before a mount or a focus
     * refetches it: the default for every query. A hook that needs another
     * lifetime says so itself.
     */
    staleTimeMs: 60_000,
    /** How many times a failed query is retried; a 4xx never is. */
    retries: 1,
    /** How long the deployment's capabilities stay fresh: they change on a redeploy, not while a tab is open. */
    capabilitiesStaleMs: 5 * 60_000,
    /**
     * How long the caller's feature flags stay fresh: short enough that a kill
     * switch lands within a minute of the next focus, long enough that
     * navigating between screens does not refetch.
     */
    featureFlagsStaleMs: 60_000,
  },
  session: {
    /**
     * How many times the startup session lookup is retried, so one network
     * blip does not read as "logged out" and bounce the user to /login.
     */
    restoreRetries: 2,
    /** The first retry's delay; each one after doubles it, up to the cap. */
    restoreRetryBaseMs: 1_000,
    restoreRetryMaxMs: 5_000,
  },
  /**
   * How often a time on screen moves (`useNow(interval)`). Pick the one that
   * matches what the text shows: a clock finer than the text is a render for a
   * number that did not change.
   */
  clock: {
    /** A clock in seconds: the provisioning pane's elapsed time, countdowns. */
    everySecondMs: 1_000,
    /** "In 3 minutes" next to a schedule, which has to turn over on time. */
    everyHalfMinuteMs: 30_000,
    /** Anything worded in minutes: ages, "2 hours ago", group headers. */
    everyMinuteMs: 60_000,
  },
  input: {
    /** How long a search field waits after the last keystroke before it filters. */
    searchDebounceMs: 300,
  },
} as const;
