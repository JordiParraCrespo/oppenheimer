import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  AnalyticsProperties,
  AnalyticsTraits,
  FeatureFlags,
  IAnalyticsClient,
} from './analytics.client';
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

  /**
   * The current flag set, or an empty one if the provider is unreachable.
   *
   * Resolving rather than rejecting on failure is deliberate: an empty map
   * means every flag reads as off, which is the same control branch callers
   * take before flags load. A rejected query would instead surface an error
   * state that every call site would have to handle to say the same thing.
   */
  async getFeatureFlags(): Promise<FeatureFlags> {
    return (await this.safelyAsync('getFeatureFlags', () => this.client.getFeatureFlags())) ?? {};
  }

  /**
   * Subscribe to provider-pushed flag reloads. Returns a no-op unsubscribe when
   * the provider has no push channel, so callers never branch on support.
   */
  onFeatureFlags(listener: () => void): () => void {
    const noop = () => {};
    if (!this.client.onFeatureFlags) return noop;

    return this.safely('onFeatureFlags', () => this.client.onFeatureFlags?.(listener)) ?? noop;
  }

  private safely<T>(operation: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (error) {
      console.warn(`[analytics] ${operation} failed`, error);
      return undefined;
    }
  }

  /**
   * The async counterpart to {@link safely} — a provider that returns a
   * rejected promise has to be caught here too, or an unhandled rejection
   * escapes into the app.
   */
  private async safelyAsync<T>(operation: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[analytics] ${operation} failed`, error);
      return undefined;
    }
  }
}
