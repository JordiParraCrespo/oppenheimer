import { LlmError } from './llm.errors';
import type { LlmProviderId } from './llm.types';

/** How long to stop when a provider refused for its rate and did not say until when. */
const DEFAULT_PAUSE_MS = 30_000;
/** The longest pause honoured, so a malformed header cannot switch naming off for an hour. */
const MAX_PAUSE_MS = 10 * 60_000;

/** What this reads off a refusal, so a test double needs no real `Response`. */
interface Refusal {
  status: number;
  headers: { get(name: string): string | null };
}

/**
 * One provider's "not until", held by its service.
 *
 * Every provider here answers a `429` with `Retry-After` (OpenAI also sends
 * `retry-after-ms`). Calling again before then only earns another refusal, so a
 * paused provider is refused here, without a request, as `rate_limited`.
 *
 * It lives in the process rather than in Redis: this package depends on nothing
 * in the workspace, and every caller of `complete` has a fallback, so the cost
 * of another replica learning the limit from its own refusal is one call
 * (`.agents/rules/integrations.md`).
 */
export class ProviderPause {
  private until = 0;

  /** Throw `rate_limited` while the provider said to wait. */
  assertOpen(provider: LlmProviderId, now: number = Date.now()): void {
    if (now >= this.until) return;
    throw new LlmError(
      'rate_limited',
      provider,
      `${provider} asked us to wait until ${new Date(this.until).toISOString()}; not called`,
      429,
      { resetAt: new Date(this.until) },
    );
  }

  /**
   * The `rate_limited` error for a refusal that was about rate, pausing the
   * provider until it may be called again; `null` for any other refusal.
   */
  refusal(
    provider: LlmProviderId,
    response: Refusal,
    detail: string,
    now: number = Date.now(),
  ): LlmError | null {
    if (response.status !== 429) return null;
    const asked = retryAt(response, now) ?? now + DEFAULT_PAUSE_MS;
    this.until = Math.max(this.until, Math.min(Math.max(asked, now + 1_000), now + MAX_PAUSE_MS));
    return new LlmError(
      'rate_limited',
      provider,
      `${provider} answered 429${detail ? `: ${detail}` : ''}`,
      429,
      { resetAt: new Date(this.until) },
    );
  }
}

function retryAt(response: Refusal, now: number): number | null {
  const header = (name: string) => {
    try {
      return response.headers.get(name);
    } catch {
      return null;
    }
  };
  const ms = Number(header('retry-after-ms'));
  if (header('retry-after-ms') !== null && Number.isFinite(ms) && ms >= 0) return now + ms;
  const value = header('retry-after');
  if (value === null) return null;
  const seconds = Number(value);
  if (value.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : date;
}
