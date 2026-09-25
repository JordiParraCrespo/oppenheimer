import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { AnalyticsProperties, AnalyticsTraits, IAnalyticsClient } from './analytics.client';
import type { AnalyticsEvent } from './analytics.events';

/**
 * The application-facing analytics API.
 *
 * Every call into the provider is wrapped so a failing or misconfigured
 * analytics SDK can never break the product — a dropped event is always
 * preferable to a broken login. Failures are warned once per call rather than
 * thrown, which keeps them visible in development without escalating.
 */
@injectable()
export class AnalyticsService {
  constructor(
    @inject(TOKENS.AnalyticsClient)
    private readonly client: IAnalyticsClient,
  ) {}

  /** Record a product event from the catalog in `analytics.events.ts`. */
  capture(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    this.safely('capture', () => this.client.capture(event, properties));
  }

  identify(userId: string, traits?: AnalyticsTraits): void {
    this.safely('identify', () => this.client.identify(userId, traits));
  }

  reset(): void {
    this.safely('reset', () => this.client.reset());
  }

  pageView(path: string, properties?: AnalyticsProperties): void {
    this.safely('pageView', () => this.client.pageView(path, properties));
  }

  private safely<T>(operation: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (error) {
      console.warn(`[analytics] ${operation} failed`, error);
      return undefined;
    }
  }
}
