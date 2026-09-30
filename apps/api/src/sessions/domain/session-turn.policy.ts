import { SESSION_EVENT_KINDS, type SessionLogEntry } from './session-state.policy';

/**
 * A session's turns, folded from its log
 * (`product/versions/mvp/16-automations-architecture.md` §Q4).
 *
 * A turn is one prompt given to the agent and what became of it; the states are
 * OpenAI's run states (session = thread, turn = run). An automation's run is the
 * first turn of the session it started. Pure and total like the session fold:
 * `session_turn` rows are a projection written in the transaction that appends the
 * events, and a replay rebuilds them.
 *
 * Two drives feed it:
 *
 * - **interactive** (today): the prompt rides the launch as the agent's first
 *   argument, and the only evidence is what the screen manifest observes. The turn
 *   starts with the session, waits on a person while the agent is `blocked`, and
 *   completes on `done`, or on `idle` after having been seen working. It fails with
 *   the session and is cancelled when the session is stopped or closed under it.
 * - **headless** (the next slice): the runner reports `turn.started` and
 *   `turn.ended` with the exit code, result and cost, evidence that wins over the
 *   inference above.
 */
export const TURN_STATES = [
  'queued',
  'in_progress',
  'requires_action',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const;
export type TurnState = (typeof TURN_STATES)[number];

/** The states a turn can still leave. Everything else is final. */
export const LIVE_TURN_STATES = [
  'queued',
  'in_progress',
  'requires_action',
] as const satisfies readonly TurnState[];

export const TURN_ORIGINS = ['person', 'automation', 'follow_up'] as const;
export type TurnOrigin = (typeof TURN_ORIGINS)[number];

export const TURN_DRIVES = ['interactive', 'headless'] as const;
export type TurnDrive = (typeof TURN_DRIVES)[number];

/** Who asked for a session. The first turn's origin is the session's. */
export const SESSION_ORIGINS = ['person', 'automation'] as const;
export type SessionOrigin = (typeof SESSION_ORIGINS)[number];

/** The kinds a headless runner and the follow-up path write. */
export const TURN_EVENT_KINDS = {
  /** A follow-up prompt for the next turn. Payload `{ prompt, origin? }`. */
  REQUESTED: 'turn.requested',
  /** The agent process for a turn started. Payload `{ turn?, agentSessionId? }`. */
  STARTED: 'turn.started',
  /**
   * The agent process exited. Payload `{ turn?, exitCode, result?, costUsd?,
   * permissionDenials?, outputRef? }`.
   */
  ENDED: 'turn.ended',
} as const;

export interface SessionTurnFold {
  seq: number;
  origin: TurnOrigin;
  drive: TurnDrive;
  state: TurnState;
  /** The prompt the agent was given, exactly as rendered. */
  prompt: string | null;
  /** Whether the agent was ever seen working on this turn — what makes `idle` mean "finished". */
  observedWorking: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  exitCode: number | null;
  agentSessionId: string | null;
  result: string | null;
  failureDetail: string | null;
  costUsd: number | null;
  permissionDenials: number;
  outputRef: string | null;
}

export function isLiveTurn(turn: Pick<SessionTurnFold, 'state'> | null): boolean {
  return turn !== null && (LIVE_TURN_STATES as readonly string[]).includes(turn.state);
}

function newTurn(
  seq: number,
  origin: TurnOrigin,
  prompt: string | null,
  drive: TurnDrive = 'interactive',
): SessionTurnFold {
  return {
    seq,
    origin,
    drive,
    state: 'queued',
    prompt,
    observedWorking: false,
    startedAt: null,
    endedAt: null,
    exitCode: null,
    agentSessionId: null,
    result: null,
    failureDetail: null,
    costUsd: null,
    permissionDenials: 0,
    outputRef: null,
  };
}

function field(payload: unknown, name: string): unknown {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[name]
    : undefined;
}

function text(payload: unknown, name: string): string | null {
  const value = field(payload, name);
  return typeof value === 'string' && value.trim() ? value : null;
}

function integer(payload: unknown, name: string): number | null {
  const value = field(payload, name);
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function finiteNumber(payload: unknown, name: string): number | null {
  const value = field(payload, name);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function end(turn: SessionTurnFold, state: TurnState, at: Date): SessionTurnFold {
  return { ...turn, state, endedAt: turn.endedAt ?? at, startedAt: turn.startedAt ?? null };
}

/**
 * Apply one log entry to the session's latest turn.
 *
 * Returns the turn as it now stands — the same object when nothing changed, a
 * new one when it moved, and a turn with the next `seq` when the entry opened
 * one. The repository writes it back when it is not the one it passed in.
 */
export function foldTurnEvent(
  latest: SessionTurnFold | null,
  event: SessionLogEntry,
  sessionOrigin: SessionOrigin,
): SessionTurnFold | null {
  const at = event.occurredAt;
  const live = isLiveTurn(latest);

  switch (event.kind) {
    case SESSION_EVENT_KINDS.PROMPT_FIRST: {
      // The first task. The API writes it at create and a runner may read it back
      // out of the agent's transcript; either way it opens turn one, once.
      if (latest) return latest;
      return newTurn(1, sessionOrigin, text(event.payload, 'text'));
    }
    case TURN_EVENT_KINDS.REQUESTED: {
      // A follow-up: the next turn, queued behind the live one if there is one.
      const origin = text(event.payload, 'origin');
      return newTurn(
        (latest?.seq ?? 0) + 1,
        origin === 'automation' ? 'automation' : 'follow_up',
        text(event.payload, 'prompt'),
        'headless',
      );
    }
    case SESSION_EVENT_KINDS.STARTED: {
      if (latest?.state !== 'queued') return latest;
      return { ...latest, state: 'in_progress', startedAt: latest.startedAt ?? at };
    }
    case SESSION_EVENT_KINDS.RESTARTED: {
      if (!latest) return latest;
      // A restart relaunches the agent with the stored prompt: a queued turn
      // starts, and a finished one is run again as the next turn, by a person.
      if (latest.state === 'queued') {
        return { ...latest, state: 'in_progress', startedAt: latest.startedAt ?? at };
      }
      if (live) return latest;
      return {
        ...newTurn(latest.seq + 1, 'person', latest.prompt, latest.drive),
        state: 'in_progress',
        startedAt: at,
      };
    }
    case SESSION_EVENT_KINDS.AGENT_OBSERVED: {
      // A headless turn reports its own end; the screen is not evidence for it.
      if (!latest || !live || latest.drive === 'headless') return latest;
      const observed = text(event.payload, 'state');
      if (observed === 'working') {
        if (latest.state === 'in_progress' && latest.observedWorking) return latest;
        return {
          ...latest,
          state: 'in_progress',
          observedWorking: true,
          startedAt: latest.startedAt ?? at,
        };
      }
      if (observed === 'blocked') {
        if (latest.state === 'requires_action') return latest;
        return {
          ...latest,
          state: 'requires_action',
          observedWorking: true,
          startedAt: latest.startedAt ?? at,
        };
      }
      // `done` is the manifest's own "turn finished" rule and is evidence on its
      // own; `idle` is only evidence once the agent was seen doing something,
      // because an agent still loading also sits at its prompt.
      if (observed === 'done' || (observed === 'idle' && latest.observedWorking)) {
        return end({ ...latest, startedAt: latest.startedAt ?? at }, 'completed', at);
      }
      return latest;
    }
    case TURN_EVENT_KINDS.STARTED: {
      if (!latest || !live) return latest;
      return {
        ...latest,
        drive: 'headless',
        state: 'in_progress',
        startedAt: latest.startedAt ?? at,
        agentSessionId: text(event.payload, 'agentSessionId') ?? latest.agentSessionId,
      };
    }
    case TURN_EVENT_KINDS.ENDED: {
      if (!latest) return latest;
      const exitCode = integer(event.payload, 'exitCode');
      const ended: SessionTurnFold = {
        ...latest,
        drive: 'headless',
        exitCode,
        startedAt: latest.startedAt ?? at,
        agentSessionId: text(event.payload, 'agentSessionId') ?? latest.agentSessionId,
        result: text(event.payload, 'result') ?? latest.result,
        costUsd: finiteNumber(event.payload, 'costUsd') ?? latest.costUsd,
        permissionDenials: integer(event.payload, 'permissionDenials') ?? latest.permissionDenials,
        outputRef: text(event.payload, 'outputRef') ?? latest.outputRef,
      };
      // The exit code is the wrapper's, so it decides even a turn the screen had
      // already called finished.
      return end(ended, exitCode === 0 ? 'completed' : 'failed', at);
    }
    case SESSION_EVENT_KINDS.FAILED: {
      if (!latest || !live) return latest;
      return end(
        { ...latest, failureDetail: text(event.payload, 'detail') ?? latest.failureDetail },
        'failed',
        at,
      );
    }
    case SESSION_EVENT_KINDS.STOPPED:
    case SESSION_EVENT_KINDS.CLOSED: {
      if (!latest || !live) return latest;
      return end(latest, 'cancelled', at);
    }
    default:
      return latest;
  }
}

/** Two folds describe the same stored row. */
export function sameTurn(a: SessionTurnFold | null, b: SessionTurnFold | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.seq === b.seq &&
    a.state === b.state &&
    a.drive === b.drive &&
    a.observedWorking === b.observedWorking &&
    a.startedAt?.getTime() === b.startedAt?.getTime() &&
    a.endedAt?.getTime() === b.endedAt?.getTime() &&
    a.exitCode === b.exitCode &&
    a.agentSessionId === b.agentSessionId &&
    a.result === b.result &&
    a.failureDetail === b.failureDetail &&
    a.costUsd === b.costUsd &&
    a.permissionDenials === b.permissionDenials &&
    a.outputRef === b.outputRef &&
    a.prompt === b.prompt
  );
}
