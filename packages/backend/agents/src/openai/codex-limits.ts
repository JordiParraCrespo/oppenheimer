import type { BotPlanLimits, BotPlanWindow } from '../bot-engine';

/** Longer than a day is the weekly window; a day or less, the 5-hour one. */
const DAY_MINUTES = 24 * 60;

/**
 * A ChatGPT subscription's usage windows, read off the headers ChatGPT's
 * Codex backend answers every request with, the way the Codex CLI reads
 * them (`codex-rs/codex-api/src/rate_limits.rs`): `x-codex-primary-*` and
 * `x-codex-secondary-*`, each a `used-percent` (0–100), a `window-minutes`
 * and a `reset-at` in Unix seconds. Which one is the 5-hour window and which
 * the weekly is told by `window-minutes`, falling back to primary and
 * secondary when it is missing. A window the answer sends as 0% with no
 * length and no reset is a placeholder for one the plan does not track, as
 * the Codex CLI reads it, and is left out like a missing one.
 */
export function codexLimitsOf(headers: Headers): BotPlanLimits | null {
  const number = (name: string) => {
    const raw = headers.get(name);
    return raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  };
  const window = (name: 'primary' | 'secondary') => {
    const used = number(`x-codex-${name}-used-percent`);
    if (!Number.isFinite(used)) return null;
    const minutes = number(`x-codex-${name}-window-minutes`);
    const reset = number(`x-codex-${name}-reset-at`);
    const hasMinutes = Number.isFinite(minutes) && minutes > 0;
    const hasReset = Number.isFinite(reset) && reset > 0;
    if (used === 0 && !hasMinutes && !hasReset) return null;
    const limit: BotPlanWindow = {
      usedPercent: Math.min(100, Math.max(0, used)),
      resetsAt: hasReset ? new Date(reset * 1_000) : null,
    };
    const weekly = hasMinutes ? minutes > DAY_MINUTES : name === 'secondary';
    return { limit, weekly };
  };
  let fiveHour: BotPlanWindow | null = null;
  let sevenDay: BotPlanWindow | null = null;
  for (const read of [window('primary'), window('secondary')]) {
    if (!read) continue;
    if (read.weekly) sevenDay ??= read.limit;
    else fiveHour ??= read.limit;
  }
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
