import type {
  AnalyticsProperties,
  AnalyticsTraits,
  FeatureFlags,
  IAnalyticsClient,
} from './analytics.client';

/**
 * The default client when no provider is configured.
 *
 * The boilerplate has to boot and run with no analytics account, so this is
 * what {@link OppenheimerApp} falls back to. Every method is a no-op and every flag
 * reads as off, which means feature-flagged code paths stay on their default
 * branch rather than crashing.
 */
export class NoopAnalyticsClient implements IAnalyticsClient {
  capture(_event: string, _properties?: AnalyticsProperties): void {}

  identify(_userId: string, _traits?: AnalyticsTraits): void {}

  reset(): void {}

  pageView(_path: string, _properties?: AnalyticsProperties): void {}

  /** No flags, so every lookup falls through to its default branch. */
  async getFeatureFlags(): Promise<FeatureFlags> {
    return {};
  }
}
