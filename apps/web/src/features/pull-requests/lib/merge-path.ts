import type { StatusState, Step } from '@oppenheimer/design-system-web';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/**
 * The gates on the path to merge, worded: met, failed, held or still to come.
 * What holds the merge (a draft, a required approval, a change request) is
 * the Merge gate's word, so the strip names the one thing to do next.
 */
export function mergeSteps(pull: PullRequestDetailEntity, t: TFunction): Step[] {
  const base = pull.baseRef;
  const words = { base, failed: pull.checkCounts.failed, pending: pull.checkCounts.pending };
  return pull.gates.map((gate) => {
    const label = t(`pullRequests.detail.gates.${gate.id}`);
    if (pull.state === 'merged') {
      return {
        id: gate.id,
        label,
        meta: t(`pullRequests.detail.gateMeta.${gate.id}.done`, words),
        state: 'done',
      };
    }
    if (gate.id === 'merge') {
      return pull.blocker
        ? { id: gate.id, label, meta: t(`pullRequests.blocker.${pull.blocker}`), state: 'running' }
        : {
            id: gate.id,
            label,
            meta: t('pullRequests.detail.gateMeta.merge.pending', words),
            state: 'pending',
          };
    }
    return {
      id: gate.id,
      label,
      meta: t(`pullRequests.detail.gateMeta.${gate.id}.${gate.state}`, words),
      state: gate.state,
    };
  });
}

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
