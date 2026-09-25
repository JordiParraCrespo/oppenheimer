import type {
  AnalyticsProperties,
  AnalyticsTraits,
  IAnalyticsClient,
} from '@oppenheimer/frontend-core';
import { sanitizeUrlProperties } from '@oppenheimer/frontend-core';
import type { CaptureResult, PostHog } from 'posthog-js';

/**
 * Scrubs query strings out of the URL properties PostHog attaches to every
 * event — `$current_url`, `$referrer` and their `$initial_` variants, on
 * autocapture events the app never raises itself as well as its own. Sending
 * only the pathname from `pageView()` does not cover those, so without this a
 * route like `/reset-password?token=…` leaks the token.
 *
 * Wired to `before_send`, which runs last, after PostHog has extracted UTM
 * parameters into their own properties — campaign attribution survives.
 */
function stripUrlSecrets(result: CaptureResult | null): CaptureResult | null {
  if (!result) return result;

  result.properties = sanitizeUrlProperties(result.properties);
  return result;
}

/**
 * PostHog adapter for the web app.
 *
 * The SDK is loaded with a dynamic `import()` rather than a static one, so it
 * lands in its own chunk and is fetched only when a project key is configured.
 * That keeps ~50KB of vendor JavaScript off the critical path of the marketing
 * and auth pages, where it would otherwise cost Core Web Vitals for visitors
 * who never reach the app.
 *
 * Because loading is async but the DI container is built synchronously, calls
 * made before the SDK arrives are queued and replayed on load.
 *
 * Feature flags do not come from here — the API evaluates them — so PostHog's
 * own flag loading is switched off: no `/flags` request per page load, and an
 * ad blocker that eats PostHog cannot change what the product shows.
 */
class PostHogAnalyticsClient implements IAnalyticsClient {
  private posthog: PostHog | null = null;
  private pending: Array<(posthog: PostHog) => void> = [];

  constructor(
    private readonly apiKey: string,
    private readonly host: string,
  ) {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const { default: posthog } = await import('posthog-js');

      posthog.init(this.apiKey, {
        api_host: this.host,
        // Page views are driven from the router via `usePageView`. PostHog's
        // automatic capture only fires on hard loads, which in a SPA means
        // every client-side navigation would go uncounted.
        capture_pageview: false,
        persistence: 'localStorage+cookie',
        // Runs on every outgoing event, including the autocapture ones we
        // never raise ourselves. See `stripUrlSecrets`.
        before_send: stripUrlSecrets,
        advanced_disable_feature_flags: true,
      });

      this.posthog = posthog;
      for (const call of this.pending) call(posthog);
      this.pending = [];
    } catch (error) {
      // A blocked or failed SDK load must not break the app. Every subsequent
      // call stays queued against a client that never arrives, which is
      // functionally the no-op client.
      console.warn('[analytics] PostHog failed to load', error);
    }
  }

  private enqueue(call: (posthog: PostHog) => void): void {
    if (this.posthog) {
      call(this.posthog);
    } else {
      this.pending.push(call);
    }
  }

  capture(event: string, properties?: AnalyticsProperties): void {
    this.enqueue((posthog) => posthog.capture(event, properties));
  }

  identify(userId: string, traits?: AnalyticsTraits): void {
    this.enqueue((posthog) => posthog.identify(userId, traits));
  }

  reset(): void {
    this.enqueue((posthog) => posthog.reset());
  }

  pageView(path: string, properties?: AnalyticsProperties): void {
    // `$current_url` is left to PostHog, which reads it from `window.location`
    // and has it sanitized by `before_send` like every other event — overriding
    // it here would make page views the only events carrying a relative path.
    this.enqueue((posthog) => posthog.capture('$pageview', { $pathname: path, ...properties }));
  }
}

/**
 * Builds the analytics client from the environment, or returns `undefined`
 * when no key is set so the app falls back to the no-op client. The boilerplate
 * has to run with no analytics account, so an unset key is a supported state,
 * not a misconfiguration.
 */
export function createWebAnalyticsClient(): IAnalyticsClient | undefined {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!apiKey) return undefined;

  // Defaults to the EU cloud region. Set VITE_POSTHOG_HOST to
  // https://us.i.posthog.com for a US project, or to your own host if
  // self-hosting.
  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

  return new PostHogAnalyticsClient(apiKey, host);
}
