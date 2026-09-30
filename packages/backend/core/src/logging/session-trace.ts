/**
 * A session's start, on the record, across the three tiers that run it.
 *
 * Start is the console, the control plane and the host, and until now only the
 * host's own stages were timed (`session.step`). A host that had the agent
 * answering in three seconds could therefore sit behind a console that showed
 * nothing for thirty, with the gap in the two tiers nobody was timing. Every
 * tier now writes the same line — epoch milliseconds, tier, mark, session —
 * so the three logs join into one ordered timeline.
 *
 * Off unless `OPPENHEIMER_TRACE=1`. It is a debugging instrument, not
 * telemetry: there is no sink, no sampling and nothing kept.
 */
// Read on the first mark, not at import: the root `.env` is loaded by the
// bootstrap, which runs after this module is evaluated.
let armed: boolean | null = null;

/** One mark. `session` is what joins it to the browser's and the host's lines. */
export function traceSession(mark: string, fields: Record<string, unknown> = {}): void {
  armed ??= process.env.OPPENHEIMER_TRACE === '1';
  if (!armed) return;
  const rest = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  // Deliberately stdout and not the Nest logger: one grep-able line per mark,
  // in the same shape the browser and the runner write.
  process.stdout.write(`[optrace] ${Date.now()} api ${mark}${rest ? ` ${rest}` : ''}\n`);
}
