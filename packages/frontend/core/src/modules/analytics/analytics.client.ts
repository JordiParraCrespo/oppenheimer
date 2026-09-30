/**
 * Platform-agnostic analytics contract: each platform adapts its provider SDK
 * (`posthog-js` in the browser) to it, so the rest of the frontend never
 * imports a vendor SDK. Feature flags are not part of it: the API evaluates
 * them (the `feature-flags` module), so a blocked analytics SDK can never turn
 * a kill switch back on.
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

export interface IAnalyticsClient {
  capture(event: string, properties?: AnalyticsProperties): void;
  /** Associate subsequent events with a user. */
  identify(userId: string, traits?: AnalyticsTraits): void;
  /** Drop the current identity so later events aren't misattributed. */
  reset(): void;
  pageView(path: string, properties?: AnalyticsProperties): void;
}
