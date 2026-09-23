/**
 * What the console draws while a session starts: the host's own account of it,
 * read back off the session's event log.
 *
 * The runner logs each step as it starts and finishes (`session.step`, payload
 * `{ step, status }`), the host step first — the moment the create frame reached
 * it. `session.started` means every step landed; `session.failed` means the one
 * still running did not. Nothing here is timed on the client: a step that has
 * not been reported is pending, never "probably nearly done".
 */

/** One entry of a session's append-only log, as the console reads it. */
export interface SessionEvent {
  seq: number;
  kind: string;
  payload: unknown;
  occurredAt: Date;
}

/** The steps, in the order the host runs them. */
export const SESSION_START_STEPS = ['host', 'clone', 'worktree', 'agent'] as const;

export type SessionStartStepId = (typeof SESSION_START_STEPS)[number];

export type SessionStartStepState = 'pending' | 'running' | 'done' | 'failed';

export interface SessionStartStep {
  id: SessionStartStepId;
  state: SessionStartStepState;
  /** When the host reported it started, if it did. */
  startedAt: Date | null;
  /** When it finished, if it did. */
  finishedAt: Date | null;
}

const STEP_KIND = 'session.step';
const STARTED_KIND = 'session.started';
const FAILED_KIND = 'session.failed';

/**
 * Whether the log already says how the start ended. The row's lifecycle is
 * folded from this same log, so a start that ended always has one of the two
 * here — which makes this, not the row, the thing to stop polling on: the row
 * can turn `failed` one read before the page holding the host's reason does.
 */
export function isSessionStartSettled(events: readonly SessionEvent[] | undefined): boolean {
  return Boolean(
    events?.some((event) => event.kind === STARTED_KIND || event.kind === FAILED_KIND),
  );
}

function isStepId(value: unknown): value is SessionStartStepId {
  return (SESSION_START_STEPS as readonly unknown[]).includes(value);
}

function stepPayload(payload: unknown): { step: SessionStartStepId; status: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const { step, status } = payload as Record<string, unknown>;
  return isStepId(step) && typeof status === 'string' ? { step, status } : null;
}

/**
 * Fold the log into the four steps.
 *
 * The step the host is waiting on next is `running` even before it says so: once
 * the clone has finished, the worktree is what is happening, and a pane that
 * showed nothing running between two events would flicker for no reason. A
 * runner too old to log steps therefore reads as "waiting for the host" until
 * `session.started` lands, which is exactly what it is.
 */
export function deriveSessionStartSteps(events: readonly SessionEvent[]): SessionStartStep[] {
  const steps = new Map<SessionStartStepId, SessionStartStep>(
    SESSION_START_STEPS.map((id) => [
      id,
      { id, state: 'pending', startedAt: null, finishedAt: null } as SessionStartStep,
    ]),
  );
  let failed = false;
  let started = false;

  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    if (event.kind === STEP_KIND) {
      const reported = stepPayload(event.payload);
      if (!reported) continue;
      const step = steps.get(reported.step) as SessionStartStep;
      if (reported.status === 'running') {
        step.state = 'running';
        step.startedAt = event.occurredAt;
      } else if (reported.status === 'done') {
        step.state = 'done';
        step.startedAt ??= event.occurredAt;
        step.finishedAt = event.occurredAt;
      }
    } else if (event.kind === STARTED_KIND) {
      started = true;
      for (const step of steps.values()) {
        if (step.state !== 'done') {
          step.state = 'done';
          step.finishedAt = event.occurredAt;
        }
      }
    } else if (event.kind === FAILED_KIND) {
      failed = true;
    }
  }

  const ordered = SESSION_START_STEPS.map((id) => steps.get(id) as SessionStartStep);
  if (started) return ordered;

  // The first step that has not landed is the one in hand: running, or — when
  // the log says the start failed — the one that failed.
  const current = ordered.find((step) => step.state !== 'done');
  if (current) current.state = failed ? 'failed' : 'running';
  // Anything after it that was reported running cannot still be; only one step
  // is ever in hand.
  for (const step of ordered.slice(current ? ordered.indexOf(current) + 1 : ordered.length)) {
    if (step.state === 'running') step.state = 'pending';
  }
  return ordered;
}
