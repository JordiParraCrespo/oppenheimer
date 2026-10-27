import type { CloudAgentStatus } from '@oppenheimer/shared/schemas/cloud-agent';

/**
 * A cloud agent's run state as the run-state dot draws it: starting is
 * queued, working is running, a finish is completed, a failure failed, and a
 * stop or an expiry is idle, since nothing is wrong and nothing moves.
 */
export const CLOUD_AGENT_DOT = {
  starting: 'queued',
  running: 'running',
  finished: 'completed',
  failed: 'failed',
  cancelled: 'idle',
  expired: 'idle',
} as const satisfies Record<CloudAgentStatus, string>;
