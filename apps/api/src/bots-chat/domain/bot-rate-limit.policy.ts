/**
 * A system a bot's tool calls (Gmail, GitHub, a calendar) limiting our
 * requests (`25-bots.md` §4, "Rate limits"). Running into one is a normal part
 * of working through a mailbox or a repository, not a fault: the call did
 * nothing, the limit passes on its own at a time the system named, and the
 * only wrong move is to call again before then. So a limited call reads to the
 * model as a wait with a time, never as the provider's error text, and the
 * turn that met it carries the time to whatever queues more work after it.
 */

/** A system limiting calls, and when it may be called again. */
export interface BotRateLimit {
  system: string;
  resetAt: Date;
}

/** The key a limited call's data carries its limit under, as JSON. */
export const RATE_LIMIT_DATA_KEY = 'rateLimit';

/** The limit as a call's data stores it. */
export function rateLimitData(limit: BotRateLimit): string {
  return JSON.stringify({ system: limit.system, resetAt: limit.resetAt.toISOString() });
}

/** The limit a call's data carried (JSON, as tool data is strings), or null when none or malformed. */
export function rateLimitOfData(value: string | undefined): BotRateLimit | null {
  if (!value) return null;
  try {
    return rateLimitOfRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

/** A limit stored as `{ system, resetAt }` with the time as ISO, or null when it is not one. */
export function rateLimitOfRecord(value: unknown): BotRateLimit | null {
  if (!value || typeof value !== 'object') return null;
  const { system, resetAt } = value as { system?: unknown; resetAt?: unknown };
  if (typeof system !== 'string' || typeof resetAt !== 'string') return null;
  const at = new Date(resetAt);
  return Number.isNaN(at.getTime()) ? null : { system, resetAt: at };
}

/** The later of two limits' ends: a turn that met two waits for both. */
export function laterReset(held: Date | null, limit: BotRateLimit): Date {
  return held && held >= limit.resetAt ? held : limit.resetAt;
}

/**
 * What the model reads when a call ended on a limit: who is limiting, until
 * when, that this is expected and passes, and what to do with the rest of the
 * turn. `code` is the integration's catalog code. It does not claim the call
 * changed nothing: a tool that writes in several steps may have made some
 * before the limit, and one that knows reports them as a partial answer
 * instead (`rateLimitedPartwayLine`).
 */
export function rateLimitedLine(code: string, limit: BotRateLimit, now: Date): string {
  return `${code}: ${limit.system} is limiting our requests ${untilWords(limit, now)}, and stopped this call there. ${waitAdvice(limit)}`;
}

/**
 * The tail a tool adds when the limit stopped its work partway: what it did
 * stands, the rest was not reached.
 */
export function rateLimitedPartwayLine(limit: BotRateLimit, notReached: number, now: Date): string {
  return `${limit.system} began limiting our requests ${untilWords(limit, now)}, so ${notReached} more were not reached; the ones above did change. ${waitAdvice(limit)}`;
}

function untilWords(limit: BotRateLimit, now: Date): string {
  const seconds = Math.max(1, Math.ceil((limit.resetAt.getTime() - now.getTime()) / 1000));
  const wait = seconds < 120 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
  return `until ${limit.resetAt.toISOString()} (in about ${wait})`;
}

function waitAdvice(limit: BotRateLimit): string {
  return `A limit is normal when working through a lot and passes on its own; calling ${limit.system} again before then only meets it again. Do not retry it in this turn: say what is done, what is left, and that it can go on after then. A goal's next turn waits for it on its own.`;
}
