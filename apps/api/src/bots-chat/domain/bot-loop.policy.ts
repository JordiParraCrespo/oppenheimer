import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import {
  BOT_LOOP_SELF_PACED_MAX_MINUTES,
  BOT_TURN_FAILURE_RETRIES,
  type BotLoopActivity,
  type BotTurnFailure,
  botLoopCommandOf,
  parseBotSlashCommand,
  type Scope,
} from '@oppenheimer/shared';
import type { EndedTurn } from './bot-goal.policy';
import { BotLoopEntity } from './bot-loop.entity';

/**
 * A loop runs a prompt again and again (`25-bots.md` §4.1, `/loop`; from
 * Claude Code's `/loop`). Each run is a queued turn keyed by the loop and its
 * number, so a run dispatched twice queues one; the next is a delayed job
 * carrying the time it was staged for, so a run that moved leaves the old job
 * with nothing to do. A run due while the last is still queued or running is
 * skipped; a self-paced one tries again a minute later instead.
 */

/** What every loop run's key begins with. */
export const LOOP_KEY_PREFIX = 'loop:';

/** What every run key of a loop begins with: one queued or running makes the next busy. */
export function loopKeyPrefix(loopId: string): string {
  return `${LOOP_KEY_PREFIX}${loopId}:`;
}

export function loopSourceKey(loopId: string, run: number): string {
  return `${loopKeyPrefix(loopId)}${run}`;
}

/** How long a self-paced run due while the bot is busy waits before it tries again. */
export const LOOP_BUSY_RETRY_MS = 60_000;

/** The turn a person's message queued, as the loop it sets keeps it. */
export interface LoopSettingTurn {
  organizationId: string;
  botId: string;
  id: string;
  credentialScopes: readonly Scope[] | null;
  timeZone: string | null;
}

/**
 * The loop a person's message sets (`/loop [interval] [prompt]`), or null
 * for any other message; `/loop stop` is the console's, which
 * `refuseConsoleCommand` refuses first. An interval out of range is refused
 * here, so it is never run as words of the prompt.
 */
export function loopFromMessage(
  content: string,
  turn: LoopSettingTurn,
  now: Date,
): BotLoopEntity | null {
  const command = botLoopCommandOf(parseBotSlashCommand(content));
  if (!command || command.kind === 'clear') return null;
  if (command.kind === 'invalid') {
    throw new ArgumentInvalidException('A loop runs every 1 minute to 1 day');
  }
  return BotLoopEntity.set(
    {
      organizationId: turn.organizationId,
      botId: turn.botId,
      originTurnId: turn.id,
      prompt: command.prompt,
      intervalMinutes: command.intervalMinutes,
      credentialScopes: turn.credentialScopes,
      timeZone: turn.timeZone,
    },
    now,
  );
}

/** Whether a turn is one of the loop's runs: the turn that set it, or a run it queued. */
export function isLoopTurn(
  loop: Pick<BotLoopEntity, 'id' | 'originTurnId'>,
  turn: Pick<EndedTurn, 'id' | 'sourceKey'>,
): boolean {
  return (
    turn.id === loop.originTurnId || Boolean(turn.sourceKey?.startsWith(loopKeyPrefix(loop.id)))
  );
}

/**
 * Which of the loop's runs a turn is: the turn that set it is 0, a queued run
 * its number; null for any other turn.
 */
export function loopRunOf(
  loop: Pick<BotLoopEntity, 'id' | 'originTurnId'>,
  turn: Pick<EndedTurn, 'id' | 'sourceKey'>,
): number | null {
  if (turn.id === loop.originTurnId) return 0;
  const prefix = loopKeyPrefix(loop.id);
  if (!turn.sourceKey?.startsWith(prefix)) return null;
  const run = Number(turn.sourceKey.slice(prefix.length));
  return Number.isInteger(run) ? run : null;
}

/**
 * Whether a turn's tool call may act on the loop the bot has now: one of its
 * runs, or a turn queued after it was set (the person asking in a message).
 * A run of a loop this one replaced, still working when it was replaced,
 * may not: what it decides is about the loop it was run for.
 */
export function mayActOnLoop(
  loop: Pick<BotLoopEntity, 'id' | 'originTurnId' | 'createdAt'>,
  turn: Pick<EndedTurn, 'id' | 'sourceKey'> & { createdAt: Date },
): boolean {
  if (isLoopTurn(loop, turn)) return true;
  if (turn.sourceKey?.startsWith(LOOP_KEY_PREFIX)) return false;
  return turn.createdAt.getTime() >= loop.createdAt.getTime();
}

/** A run's job, as it was staged: the run it queues and the time it was due. */
export interface LoopRunDue {
  run: number;
  at: Date;
}

/**
 * What a run's job does when it comes due: nothing when it is not the loop's
 * next any more (the run was queued, or moved, since), end the loop once it
 * has expired, or run.
 */
export function loopRunDecision(
  loop: BotLoopEntity,
  due: LoopRunDue,
  now: Date,
): 'stale' | 'expire' | 'run' {
  if (due.run !== loop.runs + 1) return 'stale';
  if (loop.nextRunAt?.getTime() !== due.at.getTime()) return 'stale';
  return loop.isExpired(now) ? 'expire' : 'run';
}

/**
 * When the run after this one is due: a fixed loop's next slot after now,
 * on its interval from the slot that was due, never past its expiry, where
 * the run due ends it; a self-paced loop's is null until its run says.
 */
export function nextRunAfter(loop: BotLoopEntity, now: Date): Date | null {
  if (loop.intervalMinutes === null) return null;
  const step = loop.intervalMinutes * 60_000;
  const from = (loop.nextRunAt ?? now).getTime();
  const slots = Math.max(1, Math.floor((now.getTime() - from) / step) + 1);
  return earlier(new Date(from + slots * step), loop.expiresAt);
}

/** When a run due while the bot is busy is tried again: a fixed loop's next slot, a self-paced one a minute on. */
export function nextRunWhenBusy(loop: BotLoopEntity, now: Date): Date {
  return (
    nextRunAfter(loop, now) ?? earlier(new Date(now.getTime() + LOOP_BUSY_RETRY_MS), loop.expiresAt)
  );
}

/** When a self-paced loop runs next, as the bot asked: 1 to 60 minutes from now, never past its expiry. */
export function selfPacedRunAt(loop: BotLoopEntity, minutes: number, now: Date): Date {
  const bounded = Math.min(Math.max(1, Math.round(minutes)), BOT_LOOP_SELF_PACED_MAX_MINUTES);
  return earlier(new Date(now.getTime() + bounded * 60_000), loop.expiresAt);
}

function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** How a loop ends, as its line says it. */
export interface LoopEnding {
  activity: Exclude<BotLoopActivity, 'ran'>;
  reason: string | null;
}

/** What the end of one of the loop's runs does to it. */
export type LoopRunEnd = ({ kind: 'end' } & LoopEnding) | { kind: 'retry' } | { kind: 'keep' };

/**
 * What the end of one of the loop's runs means for it. A run the person
 * stopped stops it, and so does one that failed in a way the next run would
 * meet again (a refused key, a spent plan, a refusal); one stopped by the
 * turn's time or step limit or a passing failure (a rate limit, an outage) keeps
 * it: its work is kept and the next run starts afresh. A self-paced run
 * that did not say when to run next ends it, unless it failed in passing,
 * when it is tried again a minute later. Only the loop's latest run decides:
 * another turn's end, or a late word about a run the loop has gone past (its
 * next is already queued), changes nothing.
 */
export function loopRunEnd(loop: BotLoopEntity, ended: EndedTurn): LoopRunEnd {
  if (loopRunOf(loop, ended) !== loop.runs) return { kind: 'keep' };
  if (ended.status === 'cancelled')
    return { kind: 'end', activity: 'stopped', reason: 'cancelled' };
  const failed = ended.status === 'failed';
  if (failed && !passing(ended.failure)) {
    return { kind: 'end', activity: 'stopped', reason: 'failed' };
  }
  if (!loop.selfPaced || loop.nextRunAt !== null) return { kind: 'keep' };
  return failed ? { kind: 'retry' } : { kind: 'end', activity: 'ended', reason: null };
}

/** A failure the next run would not meet again: a limit of one turn, or one sending again can get past. */
function passing(failure: BotTurnFailure | null): boolean {
  return (
    failure !== null &&
    (failure === 'time_limit' || failure === 'step_limit' || BOT_TURN_FAILURE_RETRIES[failure])
  );
}
