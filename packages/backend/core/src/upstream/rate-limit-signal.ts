/**
 * What an upstream answer says about its rate limit: the one place that
 * decides whether a call was refused for rate.
 *
 * Headers are read here, in the spellings providers use:
 *
 * - `Retry-After` (RFC 9110): seconds, or an HTTP date.
 * - `X-RateLimit-Remaining` / `X-RateLimit-Reset`: GitHub, Slack, Discord and
 *   most others. The reset is epoch seconds for some and seconds-from-now for
 *   others; a value past 10⁹ can only be an epoch, so that is the tell.
 * - `RateLimit-Remaining` / `RateLimit-Reset` and the structured
 *   `RateLimit: "default";r=0;t=30` of the IETF draft
 *   (draft-ietf-httpapi-ratelimit-headers), which defines the reset as
 *   seconds-from-now and nothing else; that is the only unit read there.
 *
 * What only a body says (GitHub's secondary limit, Google's
 * `rateLimitExceeded`) is the adapter's to read, since only it knows the
 * provider's shape; it hands the answer in as `bodyLimited`.
 */
export interface RateLimitSignal {
  /**
   * The provider refused this call for its rate: a `429`, a refusal whose body
   * said so, or a `403` with an exhausted budget or a `Retry-After`.
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

export interface ReadRateLimitOptions {
  /** The adapter read the error body and it names a rate or quota refusal. */
  bodyLimited?: boolean;
  now?: number;
}

/** Past this, a reset can only be epoch seconds: 10⁹ seconds from now is 2058. */
const EPOCH_THRESHOLD = 1_000_000_000;

export function readRateLimit(
  response: RateLimitedResponse,
  options: ReadRateLimitOptions = {},
): RateLimitSignal {
  const now = options.now ?? Date.now();
  const header = (name: string): string | null => response.headers.get(name);

  const structured = parseStructured(header('ratelimit'));
  const remaining =
    numberOf(header('x-ratelimit-remaining')) ??
    numberOf(header('ratelimit-remaining')) ??
    structured.remaining;

  const retryAfter = retryAfterOf(header('retry-after'), now);
  const reset =
    xResetOf(header('x-ratelimit-reset'), now) ??
    deltaOf(numberOf(header('ratelimit-reset')), now) ??
    deltaOf(structured.resetSeconds, now);

  const refused = response.status >= 400;
  const limited =
    response.status === 429 ||
    (refused && options.bodyLimited === true) ||
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

/** `X-RateLimit-Reset`: epoch seconds (GitHub) or seconds from now (others). */
function xResetOf(value: string | null, now: number): Date | null {
  const seconds = numberOf(value);
  if (seconds === null) return null;
  return seconds > EPOCH_THRESHOLD ? new Date(seconds * 1000) : new Date(now + seconds * 1000);
}

function deltaOf(seconds: number | null, now: number): Date | null {
  return seconds === null ? null : new Date(now + seconds * 1000);
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
