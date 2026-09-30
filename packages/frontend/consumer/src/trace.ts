/**
 * A session's timeline, as the browser sees it.
 *
 * Start is three tiers — the console, the control plane, the host — and until
 * now only the host's own stages were on the record (`session.step`). That is
 * why a host that had the agent answering in three seconds could sit behind a
 * console that showed nothing for thirty: the gap was in the two tiers nobody
 * was timing. Each tier now writes the same line, keyed by the session, so the
 * three logs join into one ordered timeline.
 *
 * Off unless asked for: `localStorage.optrace = '1'`. It is a debugging
 * instrument, not telemetry — nothing leaves the browser.
 */
const PREFIX = '[optrace]';

let armed: boolean | null = null;

function on(): boolean {
  if (armed === null) {
    try {
      armed = globalThis.localStorage?.getItem('optrace') === '1';
    } catch {
      armed = false;
    }
  }
  return armed;
}

/** One mark. `at` is epoch milliseconds, which is what joins it to the other tiers. */
export function trace(mark: string, fields?: Record<string, unknown>): void {
  if (!on()) return;
  // eslint-disable-next-line no-console
  console.log(`${PREFIX} ${Date.now()} web ${mark}`, fields ?? {});
}
