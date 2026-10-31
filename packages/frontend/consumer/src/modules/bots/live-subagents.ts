import type { BotStreamEvent, BotSubagentProgress } from '@oppenheimer/shared/schemas/bot';
import type { BotConversationEntity } from './bot-conversation.entity';

/**
 * Where each child of a running `delegate` call is, as the bot's stream last
 * said it, by the call's id. A frame carries the whole set, so the newest
 * replaces what was there; nothing here is stored or ever read back.
 */
export type BotSubagentFrames = Readonly<
  Record<string, { turnId: string; runs: readonly BotSubagentProgress[] }>
>;

/** The children to draw under each running `delegate` call, by the call's id. */
export type BotLiveSubagents = Readonly<Record<string, readonly BotSubagentProgress[]>>;

export const NO_BOT_SUBAGENTS: BotSubagentFrames = {};

/** A `subagents` frame, in place of the call's last one. */
export function putBotSubagents(
  frames: BotSubagentFrames,
  { turnId, callId, runs }: Extract<BotStreamEvent, { type: 'subagents' }>,
): BotSubagentFrames {
  return { ...frames, [callId]: { turnId, runs } };
}

/** Drops the calls of turns the conversation shows ended. Memory only: {@link botLiveSubagents} never draws them. */
export function forgetEndedBotSubagents(
  frames: BotSubagentFrames,
  conversation: BotConversationEntity | undefined,
): BotSubagentFrames {
  if (!conversation) return frames;
  const ended = Object.entries(frames)
    .filter(([, { turnId }]) => conversation.hasEnded(turnId))
    .map(([callId]) => callId);
  if (ended.length === 0) return frames;
  const next = { ...frames };
  for (const callId of ended) delete next[callId];
  return next;
}

/**
 * What to draw live under each `delegate` call: the frames of calls still
 * running in a turn still running. Once the stored step carries its output,
 * its stored runs are the record and the frames step aside.
 */
export function botLiveSubagents(
  frames: BotSubagentFrames,
  conversation: BotConversationEntity,
): BotLiveSubagents {
  const finished = new Set(
    conversation.messages.flatMap((message) =>
      message.steps.flatMap((step) => (step.output === null ? [] : [step.callId])),
    ),
  );
  const live: Record<string, readonly BotSubagentProgress[]> = {};
  for (const [callId, { turnId, runs }] of Object.entries(frames)) {
    if (finished.has(callId) || conversation.hasEnded(turnId)) continue;
    live[callId] = runs;
  }
  return live;
}
