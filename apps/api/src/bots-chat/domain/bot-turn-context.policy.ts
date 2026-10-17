import { isValidTimeZone } from '@oppenheimer/shared/automations';

/** A host as the turn sees it: what the owner would see on the Hosts screen. */
export interface BotPromptHost {
  name: string;
  online: boolean;
  runningSessions: number;
}

/** The facts of the moment a turn runs in, read when it starts. */
export interface TurnContextInput {
  now: Date;
  /** The sender's IANA zone; null means UTC. */
  timeZone: string | null;
  /** The bot's home host; null when it has none or the owner can no longer reach it. */
  homeHost: BotPromptHost | null;
  /** The owner's hosts, home host included; null when they could not be read. */
  hosts: readonly BotPromptHost[] | null;
}

/** How many hosts the turn context lists; the rest are counted. */
export const BOT_PROMPT_HOSTS_MAX = 10;

/** The tag the block is wrapped in; the system prompt names it. */
export const TURN_CONTEXT_TAG = 'turn_context';

/**
 * The moment a turn runs in (`25-bots.md` §2): the time in the sender's zone,
 * the bot's home host and the owner's hosts, each online or not. It changes
 * every turn, so it is not in the system prompt, which stays the same from
 * turn to turn and keeps the provider's prompt cache warm; it opens this
 * turn's message instead, and only this turn's: the stored message is what
 * the person wrote, so a later turn reads it back without it.
 */
export function composeTurnContext(input: TurnContextInput): string {
  // The send path checks the zone; a row that holds a bad one anyway reads as UTC.
  const zone = input.timeZone && isValidTimeZone(input.timeZone) ? input.timeZone : 'UTC';
  const lines = [
    `It is ${formatNow(input.now, zone)}. Give every date and time in this zone, and convert times that carry their own zone.`,
  ];
  if (input.homeHost) {
    lines.push(
      `Your home host is ${input.homeHost.name} (${input.homeHost.online ? 'online' : 'offline'}). Unless the person names another host, work you start runs there.`,
    );
  } else {
    lines.push('You have no home host. The person sets one in your settings, under Runs on.');
  }
  if (input.hosts === null) {
    lines.push("The person's hosts could not be read just now.");
  } else if (input.hosts.length === 0) {
    lines.push('The person has no hosts connected yet. They add one from Hosts in the console.');
  } else {
    const shown = input.hosts.slice(0, BOT_PROMPT_HOSTS_MAX).map(describeHost);
    const more = input.hosts.length - shown.length;
    lines.push(`The person's hosts: ${shown.join('; ')}${more > 0 ? `; and ${more} more` : ''}.`);
  }
  return `<${TURN_CONTEXT_TAG}>\n${lines.join('\n')}\n</${TURN_CONTEXT_TAG}>`;
}

/** This turn's message as the model is sent it: the turn context, then what the turn is asked. */
export function withTurnContext(context: string, prompt: string): string {
  return prompt ? `${context}\n\n${prompt}` : context;
}

function describeHost(host: BotPromptHost): string {
  const sessions =
    host.runningSessions === 1 ? '1 session running' : `${host.runningSessions} sessions running`;
  return `${host.name} (${host.online ? 'online' : 'offline'}, ${sessions})`;
}

/** "Thursday, 15 October 2026, 11:00 (Europe/Madrid, GMT+02:00)", in English for the model. */
export function formatNow(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  // ICU spells a zero offset "GMT" or "GMT+00:00" depending on its version.
  const offset = part('timeZoneName') === 'GMT' ? 'GMT+00:00' : part('timeZoneName');
  return `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} (${timeZone}, ${offset})`;
}
