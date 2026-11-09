import { createHash } from 'node:crypto';

/**
 * A turn has no step limit (`25-bots.md` §2, 2026-11-09), so what stops a
 * model that goes round in circles is this guard, on every turn, from
 * OpenClaw's tool-loop detection and its stop on repeated failures
 * (`research/lessons-from-long-running-agents.md`):
 *
 * - the same call (tool and input) that failed with the same error
 *   `FAILURE_STREAK` times in a row is not run again;
 * - the same call that answered the same thing `REPEAT_WARN` times among
 *   the last `HISTORY` calls gets a note saying so, and from `REPEAT_REFUSE`
 *   times it is not run again. A call whose answer changed is progress, so
 *   polling something that moves is never refused.
 *
 * A refused call reads to the model as an error saying why, and its data
 * carries `LOOP_GUARD_DATA_KEY`, so the caller can end a turn that keeps
 * running into the guard.
 */
export const TOOL_LOOP_FAILURE_STREAK = 3;
export const TOOL_LOOP_REPEAT_WARN = 5;
export const TOOL_LOOP_REPEAT_REFUSE = 10;
const HISTORY = 30;

/** The data key a refused call carries, with the value `refused`. */
export const LOOP_GUARD_DATA_KEY = 'loopGuard';

interface Seen {
  call: string;
  answer: string;
}

function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** A value as JSON with its object keys in order, so the same input is the same text however it was built. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export class ToolLoopGuard {
  private readonly history: Seen[] = [];
  private readonly failures = new Map<string, { answer: string; count: number }>();

  /** Why `name` with `input` is not run now; null when it may run. */
  refusal(name: string, input: unknown): string | null {
    const call = this.key(name, input);
    const failing = this.failures.get(call);
    if (failing && failing.count >= TOOL_LOOP_FAILURE_STREAK) {
      return `Not run: this exact call (${name} with the same input) failed ${failing.count} times in a row with the same error. Running it again will fail again. Change the input or the approach, or stop and report the blocker.`;
    }
    const repeats = this.repeats(call);
    if (repeats >= TOOL_LOOP_REPEAT_REFUSE) {
      return `Not run: this exact call (${name} with the same input) answered the same thing ${repeats} times. Asking again will not change it. To wait for something to change, watch it instead of polling; otherwise take another approach, or stop and report.`;
    }
    return null;
  }

  /**
   * Records what a call that ran answered, and answers the note the model
   * reads after it when it is repeating itself; null when it is not.
   */
  record(name: string, input: unknown, content: string, isError: boolean): string | null {
    const call = this.key(name, input);
    const answer = digest(content);
    if (isError) {
      const failing = this.failures.get(call);
      this.failures.set(call, {
        answer,
        count: failing?.answer === answer ? failing.count + 1 : 1,
      });
    } else {
      this.failures.delete(call);
    }
    this.history.push({ call, answer });
    if (this.history.length > HISTORY) this.history.shift();
    const repeats = this.repeats(call);
    if (repeats < TOOL_LOOP_REPEAT_WARN) return null;
    return `\n\n<loop-guard>You have made this exact call ${repeats} times and it answered the same each time. Calling it again will not change the answer; at ${TOOL_LOOP_REPEAT_REFUSE} it is no longer run. Move on: take another approach, wait with a watch, or report.</loop-guard>`;
  }

  /** How many of the recent calls were `call` and answered what its latest answer was. */
  private repeats(call: string): number {
    const latest = [...this.history].reverse().find((seen) => seen.call === call);
    if (!latest) return 0;
    return this.history.filter((seen) => seen.call === call && seen.answer === latest.answer)
      .length;
  }

  private key(name: string, input: unknown): string {
    return digest(`${name}\u0000${canonical(input)}`);
  }
}
