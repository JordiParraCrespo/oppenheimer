import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { PageFrame } from '@oppenheimer/frontend-web';
import { SessionCloudSummary } from './session-cloud-summary';

/**
 * A session in Claude Code's or Codex's cloud, once its host has started it:
 * its summary (`SessionCloudSummary`) in the status measure.
 */
export function SessionCloud({ session }: { session: SessionEntity }) {
  return (
    <PageFrame size="status">
      <SessionCloudSummary session={session} />
    </PageFrame>
  );
}
