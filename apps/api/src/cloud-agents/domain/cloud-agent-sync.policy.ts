import { type CloudAgentStatus, cloudAgentIsActive } from '@oppenheimer/shared';

/**
 * When a read asks the vendor about a run again (`product/next-steps/cloud-agents.md`).
 *
 * Cursor counts about 20 calls a minute per person. The console reads an open
 * agent every few seconds and the list every fifteen, so the open agent is
 * asked at most once in {@link DETAIL_SYNC_AFTER_MS}, and a list asks about at
 * most {@link LIST_SYNC_MAX} of its working agents, the ones heard from
 * longest ago, none more than once in {@link LIST_SYNC_AFTER_MS}: about
 * eighteen calls a minute at the most, with one agent open. A run that ended
 * is never asked about again until a follow-up starts another.
 */
export const DETAIL_SYNC_AFTER_MS = 10_000;
export const LIST_SYNC_AFTER_MS = 30_000;
export const LIST_SYNC_MAX = 3;

interface Syncable {
  status: CloudAgentStatus;
  syncedAt: Date;
}

/** Whether the vendor should be asked about `agent` now. */
export function needsSync(agent: Syncable, now: Date, afterMs: number): boolean {
  return cloudAgentIsActive(agent.status) && now.getTime() - agent.syncedAt.getTime() >= afterMs;
}

/** The working agents a list asks about: the stalest first, up to {@link LIST_SYNC_MAX}. */
export function agentsToSync<T extends Syncable>(agents: readonly T[], now: Date): T[] {
  return agents
    .filter((agent) => needsSync(agent, now, LIST_SYNC_AFTER_MS))
    .sort((a, b) => a.syncedAt.getTime() - b.syncedAt.getTime())
    .slice(0, LIST_SYNC_MAX);
}
