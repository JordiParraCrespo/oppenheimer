import type { BotApprovalEvent } from '@oppenheimer/shared/schemas/bot';

/**
 * Which line an approval's event reads as, under `bots.chat.event`: the yes
 * or the no; over the turn that reports an approved call, how it went
 * ("Done: …", "It failed: …").
 */
export function approvalLineKey(event: BotApprovalEvent) {
  if (event.stage !== 'finished') return event.outcome;
  return event.outcome === 'failed' ? 'finishedFailed' : 'finished';
}
