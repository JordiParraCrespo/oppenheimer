import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { BotApprovalEvent } from '@oppenheimer/shared/schemas/bot';

/**
 * How the chat draws an approval (`25-bots.md` §5), in one place. An
 * approved call has two lines: the yes, which opens the turn where the bot
 * says it is on it (`started`), and how it went, which opens the turn that
 * reports it (`finished`).
 */

/**
 * Which line an approval's event reads as, under `bots.chat.event`: the yes
 * or the no; over the turn that reports an approved call, how it went
 * ("Done: …", "It failed: …").
 */
export function approvalLineKey(event: BotApprovalEvent) {
  if (event.stage !== 'finished') return event.outcome;
  return event.outcome === 'failed' ? 'finishedFailed' : 'finished';
}

/** An approved call under way, as the chat draws it: what it does, and since when. */
export interface RunningApprovedCall {
  summary: string;
  since: Date;
}

/**
 * The approved calls still running, by the turn whose yes started them: a
 * `started` line whose `finished` line the chat does not hold yet. The turn
 * holds the call as its live line until the report lands.
 */
export function runningApprovedCalls(
  messages: readonly BotMessageEntity[],
): ReadonlyMap<string, RunningApprovedCall> {
  const finished = new Set<string>();
  const started: { turnId: string; approvalId: string; call: RunningApprovedCall }[] = [];
  for (const message of messages) {
    const { event, turnId } = message;
    if (event?.kind !== 'approval' || !event.approvalId) continue;
    if (event.stage === 'finished') finished.add(event.approvalId);
    if (event.stage === 'started' && turnId) {
      started.push({
        turnId,
        approvalId: event.approvalId,
        call: { summary: event.summary, since: message.createdAt },
      });
    }
  }
  return new Map(
    started
      .filter(({ approvalId }) => !finished.has(approvalId))
      .map(({ turnId, call }) => [turnId, call]),
  );
}
