import type { BotPlanLimits, BotPlanWindow } from '../bot-engine';

/**
 * A ChatGPT subscription's usage windows, read off the headers ChatGPT's
 * Codex backend answers every request with, the way the Codex CLI reads
 * them (`codex-rs/codex-api/src/rate_limits.rs`): `x-codex-primary-*` for
 * the 5-hour window and `x-codex-secondary-*` for the weekly one, each a
 * `used-percent` (0–100) and a `reset-at` in Unix seconds. A window the
 * answer leaves out is null; an answer with neither is none.
 */
export function codexLimitsOf(headers: Headers): BotPlanLimits | null {
  const window = (name: 'primary' | 'secondary'): BotPlanWindow | null => {
    const used = Number(headers.get(`x-codex-${name}-used-percent`) ?? Number.NaN);
    if (!Number.isFinite(used)) return null;
    const reset = Number(headers.get(`x-codex-${name}-reset-at`) ?? Number.NaN);
    return {
      usedPercent: Math.min(100, Math.max(0, used)),
      resetsAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1_000) : null,
    };
  };
  const fiveHour = window('primary');
  const sevenDay = window('secondary');
  return fiveHour || sevenDay ? { fiveHour, sevenDay } : null;
}

/**
 * The latest windows a run's requests were answered with: a `fetch` that
 * reads each answer's headers on the way past, for the provider's client.
 */
export class CodexLimitsRecorder {
  latest: BotPlanLimits | null = null;

  readonly fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, init);
    this.latest = codexLimitsOf(response.headers) ?? this.latest;
    return response;
  };
}
