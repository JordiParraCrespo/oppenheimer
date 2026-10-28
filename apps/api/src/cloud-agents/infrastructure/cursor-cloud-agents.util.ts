import type { CloudAgentStatus } from '@oppenheimer/shared';
import type { CloudAgentRunState } from '../application/cloud-agent-provider.port';

/** Cursor's run statuses, in ours. One Cursor adds later reads as `running` until it ends. */
const RUN_STATUSES: Readonly<Record<string, CloudAgentStatus>> = {
  CREATING: 'starting',
  RUNNING: 'running',
  WAITING_FOR_BACKGROUND_WORK: 'running',
  FINISHED: 'finished',
  ERROR: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

/**
 * A run as Cursor answers it (`GET /v1/agents/{id}/runs/{runId}`, or the
 * `run` of a launch), in our words. `git.branches[]` is the agent's, not the
 * run's: its first branch and pull request are the ones shown.
 */
export function cursorRunState(input: unknown, runId: string): CloudAgentRunState {
  const run = recordOf(input);
  const branches = Array.isArray(recordOf(run.git).branches)
    ? (recordOf(run.git).branches as unknown[]).map(recordOf)
    : [];
  return {
    runId: stringOf(run.id) ?? runId,
    status: RUN_STATUSES[stringOf(run.status) ?? ''] ?? 'running',
    branch: branches.map((entry) => stringOf(entry.branch)).find(Boolean) ?? null,
    pullRequestUrl: branches.map((entry) => stringOf(entry.prUrl)).find(Boolean) ?? null,
    summary: stringOf(run.result),
  };
}

/**
 * Cursor's error body: `{ "error": { "code", "message" } }`, or
 * `{ "code", "message" }` for an authentication refusal.
 */
export function errorOf(errorBody: string): { code: string | null; message: string | null } {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = recordOf(JSON.parse(errorBody));
  } catch {
    return { code: null, message: null };
  }
  const nested = recordOf(parsed.error);
  return {
    code: stringOf(nested.code) ?? stringOf(parsed.code),
    message: stringOf(nested.message) ?? stringOf(parsed.message) ?? stringOf(parsed.error),
  };
}

export function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
