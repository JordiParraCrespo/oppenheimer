import { createHash } from 'node:crypto';
import type { ScheduleTriggerInputDto } from '@oppenheimer/shared';

/**
 * A bot's heartbeat (`26-bot-routines.md` §6): the routine a bot is given
 * once it has a job (its `INSTRUCTIONS.md` first written), which wakes it on
 * its own once an hour to check in, read what it looks after, act on what
 * needs it and otherwise stay quiet (`nothing_to_report`). Event wakes (a pull request it watches, new mail, a
 * session it follows) still wake it at once; this is what makes it proactive
 * between them. It is an ordinary routine: the owner pauses, edits or deletes
 * it from the Routines tab or in chat.
 */

/** The routine's name, which is also how a bot that already has one is recognised. */
export const HEARTBEAT_NAME = 'Heartbeat';

/** What the bot reads on every beat, written to itself. */
export const HEARTBEAT_PROMPT = [
  'Check in. Nobody asked you anything: this is your own regular look around.',
  '1. Reread your instructions and your plan, and anything you told the person you would come back to.',
  '2. Look at what you look after, with the tools you have: the sessions you started or follow, the pull requests you watch, the person’s mail if you read it, your open questions and approvals.',
  '3. Act on what needs you now, within what you are allowed to do. Do not redo work, and do not start new work nobody asked for.',
  '4. If the person needs to know or decide something, say it in one or two lines and use notify so they see it outside this chat. Never repeat what you already told them.',
  '5. If nothing needs you or them, call nothing_to_report and write nothing.',
].join('\n');

/**
 * The minute past the hour a bot beats on: spread by its id, so a
 * workspace's bots do not all wake at :00, and the same for every replica and
 * every retry (`26-bot-routines.md` §6, "Spread, not on the minute").
 */
export function heartbeatMinute(botId: string): number {
  return createHash('sha256').update(botId).digest().readUInt32BE(0) % 60;
}

/** The heartbeat's trigger: hourly, at the bot's own minute. An hourly rule reads no zone. */
export function heartbeatTrigger(botId: string): ScheduleTriggerInputDto {
  return {
    source: 'schedule',
    frequency: 'hourly',
    hour: 0,
    minute: heartbeatMinute(botId),
    timezone: 'UTC',
  };
}

/** Whether a bot still lacks its heartbeat, from the names of its routines: a redelivery adds none. */
export function needsHeartbeat(routineNames: readonly string[]): boolean {
  return !routineNames.includes(HEARTBEAT_NAME);
}
