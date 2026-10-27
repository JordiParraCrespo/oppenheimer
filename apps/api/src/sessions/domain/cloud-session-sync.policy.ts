import type { CloudAgentStatus } from '@oppenheimer/shared';
import type { SessionCloudRunEntity } from './session-cloud-run.entity';
import { SESSION_EVENT_KINDS } from './session-state.policy';

/**
 * When a read asks a cloud session's vendor about its run again, and what the
 * answer writes to the session's log (`product/next-steps/cloud-agents.md`).
 *
 * Cursor counts about 20 calls a minute per person. The console reads the
 * sessions list every fifteen seconds, so a list asks about at most
 * {@link LIST_SYNC_MAX} of its working cloud sessions, the ones heard from
 * longest ago, none more than once in {@link LIST_SYNC_AFTER_MS}, and a
 * session read on its own is asked about at most once in
 * {@link DETAIL_SYNC_AFTER_MS}: about eighteen calls a minute at the most. A
 * run that ended is never asked about again.
 */
export const DETAIL_SYNC_AFTER_MS = 10_000;
export const LIST_SYNC_AFTER_MS = 30_000;
export const LIST_SYNC_MAX = 3;

/** Whether the vendor should be asked about `run` now. */
export function needsSync(run: SessionCloudRunEntity, now: Date, afterMs: number): boolean {
  return run.isActive && now.getTime() - run.syncedAt.getTime() >= afterMs;
}

/** The working runs a list asks about: the stalest first, up to {@link LIST_SYNC_MAX}. */
export function runsToSync(
  runs: readonly SessionCloudRunEntity[],
  now: Date,
): SessionCloudRunEntity[] {
  return runs
    .filter((run) => needsSync(run, now, LIST_SYNC_AFTER_MS))
    .sort((a, b) => a.syncedAt.getTime() - b.syncedAt.getTime())
    .slice(0, LIST_SYNC_MAX);
}

/** One entry a vendor's answer owes the session's log. */
export interface CloudRunLogEntry {
  /** Stable per run and fact, so two reads that race append it once. */
  idempotencyKey: string;
  kind: string;
  payload?: unknown;
}

/**
 * The log entries a run in `status` owes the session, in the words the fold
 * already reads for a host session:
 *
 * | Vendor | Log | Fold |
 * | --- | --- | --- |
 * | starting | (the request) | `starting` |
 * | running | `session.started`, `agent.observed` working | `open`, working |
 * | finished | `session.started`, `agent.observed` done | `open`, idle |
 * | failed, expired | `session.failed` | `failed`: waiting on you |
 * | cancelled | `session.stopped`, `agent.observed` idle | stopped, idle |
 *
 * Each entry's key names the run and the fact, so a status read twice, or by
 * two reads at once, lands once; a run that skipped `running` still opens.
 */
export function cloudRunLogEntries(runId: string, status: CloudAgentStatus): CloudRunLogEntry[] {
  const key = (fact: string) => `cloud:${runId}:${fact}`;
  const started = { idempotencyKey: key('started'), kind: SESSION_EVENT_KINDS.STARTED };
  const observed = (state: 'working' | 'done' | 'idle') => ({
    idempotencyKey: key(`observed:${state}`),
    kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
    payload: { state },
  });
  switch (status) {
    case 'starting':
      return [];
    case 'running':
      return [started, observed('working')];
    case 'finished':
      return [started, observed('done')];
    case 'failed':
    case 'expired':
      return [{ idempotencyKey: key('failed'), kind: SESSION_EVENT_KINDS.FAILED }];
    case 'cancelled':
      return [
        { idempotencyKey: key('stopped'), kind: SESSION_EVENT_KINDS.STOPPED },
        observed('idle'),
      ];
  }
}
