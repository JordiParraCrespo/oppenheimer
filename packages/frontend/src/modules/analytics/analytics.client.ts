/**
 * Platform-agnostic analytics contract.
 *
 * Each platform adapts its provider SDK — `posthog-js` in the browser,
 * `posthog-react-native` on native — to this interface, which is then injected
 * into the DI container. Keeping the boundary here means the rest of the
 * frontend package never imports a vendor SDK directly, so swapping providers
 * is a change in one file per platform rather than a refactor.
 */

/**
 * Analytics payloads cross a network boundary as JSON, so property values are
 * restricted to what survives serialization. This is a provider-independent
 * constraint — encoding it here means a `Date` or class instance is a compile
 * error rather than a `{}` that shows up in the dashboard weeks later.
 */
export type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | AnalyticsValue[]
  | { [key: string]: AnalyticsValue };

export type AnalyticsProperties = Record<string, AnalyticsValue>;

/**
 * Person properties attached to an identified user. `email` and `name` are the
 * conventional keys providers surface in their UI. These are sent to a third
 * party — keep secrets, tokens and anything you wouldn't put in a support
 * ticket out.
 */
export type AnalyticsTraits = AnalyticsProperties;

/**
 * A resolved feature flag value. `undefined` means the flag is unknown — either
 * it doesn't exist or the flags haven't loaded yet. Callers should treat that as
 * "off" rather than blocking on it.
 */
export type FeatureFlagValue = boolean | string | undefined;

/**
 * A resolved flag set: every flag the provider knows about for the current
 * user, keyed by name. A multivariate flag's value is the variant string; a
 * boolean flag's is `true`. Flags absent from the map are off.
 */
export type FeatureFlags = Record<string, boolean | string>;

export interface IAnalyticsClient {
  /** Record a product event. */
  capture(event: string, properties?: AnalyticsProperties): void;
  /** Associate subsequent events with a user. */
  identify(userId: string, traits?: AnalyticsTraits): void;
  /** Drop the current identity so later events aren't misattributed. */
  reset(): void;
  /** Record a page/screen view. */
  pageView(path: string, properties?: AnalyticsProperties): void;
  /**
   * Fetch the current flag set.
   *
   * A single async read is the whole flag contract, because it's the one shape
   * every provider can satisfy — fetching a JSON document over HTTP clears it.
   * The React layer wraps this in a TanStack Query, so caching, deduplication,
   * refetching and loading state are the query client's job rather than
   * something each adapter has to reimplement.
   */
  getFeatureFlags(): Promise<FeatureFlags>;
  /**
   * Optional: subscribe to provider-pushed flag reloads, returning an
   * unsubscribe function.
   *
   * Implement it only if the provider can tell you flags changed (PostHog can);
   * the query is invalidated when it fires, so the UI updates without a
   * refetch interval. A provider without a push channel simply omits it and
   * flags refresh on the query's normal schedule.
   */
  onFeatureFlags?(listener: () => void): () => void;
}
