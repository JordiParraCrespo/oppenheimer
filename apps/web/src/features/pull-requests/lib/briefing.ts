import type { Step } from '@oppenheimer/design-system-web';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/** The gates on the path to merge, worded: met, failed or still to come, and one line of why. */
export function mergeSteps(pull: PullRequestDetailEntity, t: TFunction): Step[] {
  const base = pull.baseRef;
  const words = { base, failed: pull.checkCounts.failed, pending: pull.checkCounts.pending };
  return pull.gates.map((gate) => {
    const state = pull.state === 'merged' ? 'done' : gate.state;
    const id = gate.id;
    const meta =
      id === 'merge'
        ? t(
            state === 'done'
              ? 'pullRequests.detail.gateMeta.merge.done'
              : 'pullRequests.detail.gateMeta.merge.pending',
            words,
          )
        : t(`pullRequests.detail.gateMeta.${id}.${state}`, words);
    return { id, label: t(`pullRequests.detail.gates.${id}`), meta, state };
  });
}

/** What the lane policy said, as a sentence. */
export function laneReasonText(
  pull: Pick<PullRequestDetailEntity, 'laneReason'>,
  t: TFunction,
): string {
  const { laneReason } = pull;
  return t(`pullRequests.laneReason.${laneReason.code}`, laneReason);
}
