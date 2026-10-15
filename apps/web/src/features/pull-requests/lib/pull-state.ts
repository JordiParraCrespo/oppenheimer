import type { StatusState } from '@oppenheimer/design-system-web';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';

/** The state the header's pill shows: open, draft, merged or closed. */
export function pullState(pull: PullRequestDetailEntity): {
  state: StatusState;
  key: 'open' | 'merged' | 'closed' | 'draft';
} {
  if (pull.state === 'merged') return { state: 'completed', key: 'merged' };
  if (pull.state === 'closed') return { state: 'idle', key: 'closed' };
  if (pull.draft) return { state: 'paused', key: 'draft' };
  return { state: 'active', key: 'open' };
}
