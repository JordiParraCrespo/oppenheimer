import type { ErrorReportContext, IErrorReportingClient } from '@oppenheimer/frontend-core';

/** What the browser SDK is to this client: the two calls it makes. */
interface SentrySdk {
  captureException(
    error: unknown,
    hint: { level?: 'fatal' | 'error' | 'warning'; tags?: Record<string, string> },
  ): string;
  setUser(user: { id: string } | null): void;
}

/** How the console is reported, read from the build's `VITE_SENTRY_*`. */
export interface WebErrorReportingOptions {
  readonly dsn: string;
  readonly environment?: string;
  readonly release?: string;
  readonly tracesSampleRate: number;
  /** Where the API is, so a traced request carries the trace to it. */
  readonly apiOrigin: string;
}

/**
 * Sentry in the browser, loaded with a dynamic `import()` in its own chunk,
 * fetched only when a DSN is configured: the SDK stays off the critical path
 * of the sign-in pages. Calls made before it arrives are queued and replayed,
 * as `PostHogAnalyticsClient` does.
 *
 * No Session Replay: a session's terminal and a bot's chat are on screen, and
 * a recording of them is a recording of somebody's code and credentials.
 */
class SentryErrorReportingClient implements IErrorReportingClient {
  private sdk: SentrySdk | null = null;
  private pending: Array<(sdk: SentrySdk) => void> | null = [];

  constructor(private readonly options: WebErrorReportingOptions) {
    void this.load();
  }

  private async load(): Promise<void> {
    let sdk: SentrySdk;
    try {
      const Sentry = await import('@sentry/react');
      const tracing = this.options.tracesSampleRate > 0;
      Sentry.init({
        dsn: this.options.dsn,
        environment: this.options.environment,
        release: this.options.release,
        sendDefaultPii: false,
        integrations: tracing ? [Sentry.browserTracingIntegration()] : [],
        tracesSampleRate: this.options.tracesSampleRate,
        tracePropagationTargets: [this.options.apiOrigin],
        beforeSend: (event) => scrubBrowserEvent(event),
        beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
      });
      sdk = Sentry;
    } catch (error) {
      // A blocked SDK (an ad blocker) must not break the app, and is not retried.
      this.pending = null;
      console.warn('[error-reporting] Sentry failed to load', error);
      return;
    }
    const queued = this.pending ?? [];
    this.pending = null;
    this.sdk = sdk;
    for (const call of queued) call(sdk);
  }

  private enqueue(call: (sdk: SentrySdk) => void): void {
    if (this.sdk) call(this.sdk);
    else this.pending?.push(call);
  }

  capture(error: unknown, context?: ErrorReportContext): void {
    const tags = tagsOf(context?.tags);
    this.enqueue((sdk) => sdk.captureException(error, { level: context?.level, tags }));
  }

  setUser(userId: string | null): void {
    this.enqueue((sdk) => sdk.setUser(userId ? { id: userId } : null));
  }
}

function tagsOf(tags: ErrorReportContext['tags']): Record<string, string> | undefined {
  if (!tags) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value !== null && value !== undefined) out[key] = String(value);
  }
  return out;
}

/** The fields of a browser event this touches. */
interface BrowserEvent {
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    query_string?: unknown;
  };
  user?: { id?: string | number };
}

/**
 * What never leaves the browser: a URL's secret query parameters (a reset
 * link's `token`), cookies and headers, and the user beyond an id.
 */
export function scrubBrowserEvent<T extends BrowserEvent>(event: T): T {
  if (event.request) {
    event.request = { url: event.request.url ? withoutQuery(event.request.url) : undefined };
  }
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  return event;
}

/** Breadcrumbs keep what happened, never a URL's secrets or a console line's text. */
export function scrubBreadcrumb<T extends { category?: string; data?: Record<string, unknown> }>(
  crumb: T,
): T | null {
  if (crumb.category === 'console') return null;
  if (crumb.data) {
    const data: Record<string, unknown> = { ...crumb.data };
    for (const key of ['url', 'from', 'to']) {
      const value = data[key];
      if (typeof value === 'string') data[key] = withoutQuery(value);
    }
    crumb.data = data;
  }
  return crumb;
}

/** A URL, absolute or not, without its query string and fragment. */
function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? '';
}

/**
 * Builds the reporting client from the environment, or `undefined` when no
 * DSN is set, so the app falls back to the no-op client: running with no
 * Sentry project is a supported state, not a misconfiguration.
 */
export function createWebErrorReportingClient(release: string): IErrorReportingClient | undefined {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return undefined;
  const rate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0);
  return new SentryErrorReportingClient({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || release,
    tracesSampleRate: Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : 0,
    apiOrigin: import.meta.env.VITE_API_URL || window.location.origin,
  });
}
