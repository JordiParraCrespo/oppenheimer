import {
  SESSION_FAILED_EVENT_KIND,
  SESSION_START_STEPS,
  SESSION_STARTED_EVENT_KIND,
  SESSION_STEP_EVENT_KIND,
  type SessionStartStepId,
  sessionFailedPayloadSchema,
  sessionStepPayloadSchema,
} from '@oppenheimer/shared/protocol';

/**
 * What the console draws while a session starts: the host's own account of it,
 * read off the session's log.
 *
 * The runner logs `session.step` (`@oppenheimer/shared/protocol`) as each step
 * starts and lands; `session.started` means every step landed, and
 * `session.failed` carries the host's reason. A step nobody reported is
 * pending: nothing here advances on its own.
 */

export type { SessionStartStepId };

/** One entry of the start log, parsed against the schema the runner writes. */
export type SessionStartEntry =
  | {
      seq: number;
      kind: 'step';
      step: SessionStartStepId;
      status: 'running' | 'done';
      durationMs: number | null;
    }
  | { seq: number; kind: 'started' }
  | { seq: number; kind: 'failed'; detail: string | null; code: string | null };

/** A raw log entry as the API returns it: the kind and a payload of unknown shape. */
export interface RawSessionLogEntry {
  seq: number;
  kind: string;
  payload: unknown;
}

/**
 * Parse the entries that concern a start, dropping everything else — other
 * kinds, and a step payload the schema refuses — rather than guessing at them.
 */
export function toStartEntry(entry: RawSessionLogEntry): SessionStartEntry | null {
  switch (entry.kind) {
    case SESSION_STEP_EVENT_KIND: {
      const parsed = sessionStepPayloadSchema.safeParse(entry.payload);
      if (!parsed.success) return null;
      return {
        seq: entry.seq,
        kind: 'step',
        step: parsed.data.step,
        status: parsed.data.status,
        durationMs: parsed.data.durationMs ?? null,
      };
    }
    case SESSION_STARTED_EVENT_KIND:
      return { seq: entry.seq, kind: 'started' };
    case SESSION_FAILED_EVENT_KIND: {
      const parsed = sessionFailedPayloadSchema.safeParse(entry.payload);
      const payload = parsed.success ? parsed.data : {};
      return {
        seq: entry.seq,
        kind: 'failed',
        detail: payload.detail?.trim() || null,
        code: payload.code ?? null,
      };
    }
    default:
      return null;
  }
}

/** Whether the log already says how the start ended. */
export function settlesStart(entry: SessionStartEntry): boolean {
  return entry.kind === 'started' || entry.kind === 'failed';
}

export type SessionStartStepState = 'pending' | 'running' | 'done' | 'failed';

export interface SessionStartStep {
  id: SessionStartStepId;
  state: SessionStartStepState;
  /** How long the step took, as the host measured it; null until it landed. */
  durationMs: number | null;
}

export interface SessionStartProgress {
  steps: SessionStartStep[];
  /** The host's reason, once the log carries it; null while it has not arrived. */
  failure: { detail: string | null; code: string | null } | null;
  /** The log says how the start ended: nothing more will arrive for it. */
  settled: boolean;
}

/**
 * Fold the start log into the four steps.
 *
 * `failed` is the session row's lifecycle. The row and the log are two reads,
 * and the row can say `failed` a read before the page carrying the reason
 * does; the step in hand is marked failed either way, and the reason follows
 * when the log has it.
 */
export function deriveSessionStartProgress(
  entries: readonly SessionStartEntry[],
  { failed }: { failed: boolean },
): SessionStartProgress {
  const steps = new Map<SessionStartStepId, SessionStartStep>(
    SESSION_START_STEPS.map((id) => [id, { id, state: 'pending', durationMs: null }]),
  );
  let started = false;
  let failure: SessionStartProgress['failure'] = null;

  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) {
    if (entry.kind === 'step') {
      const step = steps.get(entry.step) as SessionStartStep;
      step.state = entry.status;
      step.durationMs = entry.status === 'done' ? entry.durationMs : null;
    } else if (entry.kind === 'started') {
      started = true;
    } else {
      failure = { detail: entry.detail, code: entry.code };
    }
  }

  const ordered = SESSION_START_STEPS.map((id) => steps.get(id) as SessionStartStep);
  if (started) {
    for (const step of ordered) if (step.state !== 'done') step.state = 'done';
    return { steps: ordered, failure: null, settled: true };
  }
  if (failed || failure) {
    // The step in hand is the one the host last said it started; before it
    // said anything, the first step, which is where the start stopped.
    const inHand =
      [...ordered].reverse().find((step) => step.state === 'running') ??
      ordered.find((step) => step.state !== 'done');
    if (inHand) inHand.state = 'failed';
  }
  return { steps: ordered, failure, settled: failure !== null };
}
