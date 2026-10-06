/**
 * What an upstream answer says about its rate limit, read from headers alone.
 *
 * Providers spell this three ways, and this reads all of them:
 *
 * - `Retry-After` (RFC 9110): seconds, or an HTTP date.
 * - `X-RateLimit-Remaining` / `X-RateLimit-Reset`: GitHub, Slack, Discord and
 *   most others. The reset is epoch seconds for some and seconds-from-now for
 *   others; a value past 10⁹ can only be an epoch, so that is the tell.
 * - `RateLimit-Remaining` / `RateLimit-Reset`, and the structured
 *   `RateLimit: "default";r=0;t=30` of the IETF draft, where the reset is
 *   always seconds-from-now.
 *
 * A body can say more (GitHub's secondary limit, Google's `rateLimitExceeded`),
 * and reading it is the adapter's job: it knows the provider's shape, and only
 * it may read a body at all.
 */
export interface RateLimitSignal {
  /**
   * The provider refused this call for its rate: a `429`, or a `403` that came
   * with an exhausted budget or a `Retry-After`.
   */
  limited: boolean;
  /** Calls left in the current window, when the provider says. */
  remaining: number | null;
  /** When calls may resume, when the provider says. `Retry-After` wins over a reset. */
  resetAt: Date | null;
}

/** What this reads off a response, so a test double needs no real `Response`. */
export interface RateLimitedResponse {
  status: number;
  headers: { get(name: string): string | null };
}

/** Past this, a reset can only be epoch seconds: 10⁹ seconds from now is 2058. */
const EPOCH_THRESHOLD = 1_000_000_000;

export function readRateLimit(
  response: RateLimitedResponse,
  now: number = Date.now(),
): RateLimitSignal {
  const header = (name: string): string | null => {
    try {
      return response.headers?.get(name) ?? null;
    } catch {
      return null;
    }
  };

  const structured = parseStructured(header('ratelimit'));
  const remaining =
    numberOf(header('x-ratelimit-remaining')) ??
    numberOf(header('ratelimit-remaining')) ??
    structured.remaining;

  const retryAfter = retryAfterOf(header('retry-after'), now);
  const reset =
    resetOf(header('x-ratelimit-reset'), now) ??
    resetOf(header('ratelimit-reset'), now, { alwaysDelta: true }) ??
    (structured.resetSeconds === null ? null : new Date(now + structured.resetSeconds * 1000));

  const limited =
    response.status === 429 ||
    (response.status === 403 && (remaining === 0 || retryAfter !== null));

  return { limited, remaining, resetAt: retryAfter ?? reset };
}

function numberOf(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function retryAfterOf(value: string | null, now: number): Date | null {
  if (value === null) return null;
  const seconds = numberOf(value);
  if (seconds !== null) return new Date(now + seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : new Date(date);
}

function resetOf(
  value: string | null,
  now: number,
  options: { alwaysDelta?: boolean } = {},
): Date | null {
  const seconds = numberOf(value);
  if (seconds === null) return null;
  if (!options.alwaysDelta && seconds > EPOCH_THRESHOLD) return new Date(seconds * 1000);
  return new Date(now + seconds * 1000);
}

/** `"default";r=0;t=30` — `r` is what is left, `t` the seconds until it refills. */
function parseStructured(value: string | null): {
  remaining: number | null;
  resetSeconds: number | null;
} {
  if (!value) return { remaining: null, resetSeconds: null };
  const param = (key: string) =>
    numberOf(new RegExp(`(?:^|;)\\s*${key}=(\\d+)`).exec(value)?.[1] ?? null);
  return { remaining: param('r'), resetSeconds: param('t') };
}
