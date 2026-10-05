import type { AnalyticsProperties, AnalyticsTraits, IAnalyticsClient } from './analytics.client';

/** The client bound when the app passes no `analytics`, so it runs with no analytics account. */
export class NoopAnalyticsClient implements IAnalyticsClient {
  capture(_event: string, _properties?: AnalyticsProperties): void {}

  identify(_userId: string, _traits?: AnalyticsTraits): void {}

  reset(): void {}

  pageView(_path: string, _properties?: AnalyticsProperties): void {}
}
