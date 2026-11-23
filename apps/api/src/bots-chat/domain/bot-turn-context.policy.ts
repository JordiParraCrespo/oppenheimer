import type { BotChannelOrigin, BotMemoryScope } from '@oppenheimer/shared';
import { isValidTimeZone } from '@oppenheimer/shared/automations';
import { type PlainPromptId, promptText } from './bot-prompt-text.policy';
import type { BotContactChat } from './bot-turn.entity';

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
  /**
   * What the model's context held at the end of the bot's last turn; null
   * before one reported it. Said against the window when the engine knows it,
   * in tokens alone when it does not (`describeRoom`).
   */
  lastContext: { tokens: number; window: number | null } | null;
  /**
   * The bot's newest `log` facts, oldest first, and how many older facts it
   * keeps only for `recall` (`memoryInMind`). Here rather than in the system
   * prompt: a bot saves as it goes, and each save would change the prompt.
   */
  /**
   * Where the person is writing from when it is not the console (Telegram,
   * WhatsApp): the turn's last words are sent to their chat there.
   */
  channel?: BotChannelOrigin | null;
  /**
   * Whether that chat hears what the turn writes as it goes
   * (`sendsAsItGoes`): the bot is asked to say what it will do before the
   * work, and told that what the person writes meanwhile reaches it.
   */
  asItGoes?: boolean;
  /**
   * A contact's turn (`BotTurnEntity.contact`): someone who is not the owner,
   * in a direct chat or a group. Told who it is answering, and nothing of the
   * owner's (`CONTACT_LINES`): no hosts, no channel line of the owner's, no memory.
   */
  contact?: BotContactChat | null;
  memory?: {
    log: readonly { content: string; createdAt: Date; scope: BotMemoryScope }[];
    toRecall: number;
  };
}

/**
 * What a turn asked on a channel is told about where its answer goes: the
 * chat there, as plain text, read on a phone.
 */
const CHANNEL_LINES: Readonly<Record<BotChannelOrigin, PlainPromptId>> = {
  telegram: 'turn/context.on-telegram',
  whatsapp: 'turn/context.on-whatsapp',
};

/** How many hosts the turn context lists; the rest are counted. */
export const BOT_PROMPT_HOSTS_MAX = 10;

/** The tag the block is wrapped in; the system prompt names it. */
export const TURN_CONTEXT_TAG = 'turn_context';

/** What the lines are decided from: the facts as read, and the zone they are told in. */
interface Moment {
  input: TurnContextInput;
  /** The sender's zone. The send path checks it; a row that holds a bad one anyway reads as UTC. */
  zone: string;
}

/** One line of the block: its words, or null when the moment has none for it. */
type ContextLine = (moment: Moment) => string | null;

/**
 * The block's lines in the order they are sent: the time, the home host, the
 * hosts, the channel the answer goes to and how it hears the bot as it
 * works, the room left in the model's
 * context, the newest log facts and how many older ones wait for `recall`.
 * A new fact of the moment is a row.
 */
const nowLine: ContextLine = ({ input, zone }) =>
  promptText('turn/context.now', { now: formatNow(input.now, zone) });

/**
 * A contact's block: the time, and who they are to the bot. Nothing of the
 * owner's (hosts, the owner's channel line, memory), whatever the input holds.
 */
const CONTACT_LINES: readonly ContextLine[] = [
  nowLine,
  ({ input }) =>
    promptText(
      input.contact === 'group' ? 'turn/context.contact-group' : 'turn/context.contact-direct',
    ),
];

const CONTEXT_LINES: readonly ContextLine[] = [
  nowLine,
  ({ input }) =>
    input.homeHost
      ? promptText('turn/context.home-host', {
          name: input.homeHost.name,
          state: input.homeHost.online ? 'online' : 'offline',
        })
      : promptText('turn/context.no-home-host'),
  ({ input }) => describeHosts(input.hosts),
  ({ input }) => (input.channel ? promptText(CHANNEL_LINES[input.channel]) : null),
  ({ input }) => (input.channel ? promptText('turn/context.on-a-phone') : null),
  ({ input }) => (input.channel && input.asItGoes ? promptText('turn/context.as-it-goes') : null),
  ({ input }) => describeRoom(input.lastContext),
  ({ input, zone }) => describeLog(input.memory?.log ?? [], zone),
  ({ input }) => describeOlderFacts(input.memory?.toRecall ?? 0),
];

/**
 * The moment a turn runs in: the time in the sender's zone,
 * the bot's home host and the owner's hosts, each online or not. It changes
 * every turn, so it is not in the system prompt, which stays the same from
 * turn to turn and keeps the provider's prompt cache warm; it opens this
 * turn's message instead, and only this turn's: the stored message is what
 * the person wrote, so a later turn reads it back without it.
 */
export function composeTurnContext(input: TurnContextInput): string {
  const zone = input.timeZone && isValidTimeZone(input.timeZone) ? input.timeZone : 'UTC';
  const lines = (input.contact ? CONTACT_LINES : CONTEXT_LINES).flatMap(
    (line) => line({ input, zone }) ?? [],
  );
  return `<${TURN_CONTEXT_TAG}>\n${lines.join('\n')}\n</${TURN_CONTEXT_TAG}>`;
}

/** The owner's hosts, the first few by name and the rest counted, or why there are none to name. */
function describeHosts(hosts: TurnContextInput['hosts']): string {
  if (hosts === null) return promptText('turn/context.hosts-not-read');
  if (hosts.length === 0) return promptText('turn/context.no-hosts');
  const shown = hosts.slice(0, BOT_PROMPT_HOSTS_MAX).map(describeHost);
  const more = hosts.length - shown.length;
  return promptText('turn/context.hosts', {
    hosts: `${shown.join('; ')}${more > 0 ? `; and ${more} more` : ''}`,
  });
}

/** The newest log facts under their heading, each dated in the sender's zone. */
function describeLog(
  log: NonNullable<TurnContextInput['memory']>['log'],
  zone: string,
): string | null {
  if (!log.length) return null;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone });
  const entries = log.map(
    (entry) =>
      `- ${day.format(entry.createdAt)}${entry.scope === 'person' ? ' (general memory)' : ''}: ${asOneLogLine(entry.content)}`,
  );
  return `${promptText('turn/context.log')}\n${entries.join('\n')}`;
}

/** How many facts the bot keeps only for `recall`. */
function describeOlderFacts(older: number): string | null {
  if (!(older > 0)) return null;
  return older === 1
    ? promptText('turn/context.one-older-fact')
    : promptText('turn/context.older-facts', { count: String(older) });
}

/**
 * A saved note as one line of the block. A bot saves what it read outside
 * Oppenheimer as it goes, so a note must not close the block and speak as
 * the person, or start a line the block vouches for (the time, the hosts).
 */
function asOneLogLine(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .replace(new RegExp(`</?${TURN_CONTEXT_TAG}>`, 'g'), (tag) => tag.replace('<', '&lt;'));
}

/** This turn's message as the model is sent it: the turn context, then what the turn is asked. */
export function withTurnContext(context: string, prompt: string): string {
  return prompt ? `${context}\n\n${prompt}` : context;
}

/**
 * How full the model's context was when its last turn ended, as a share of
 * its window. Past half, the
 * model is asked to keep reads narrow: the turn's own tool answers fill the
 * same window, and older messages fold into the summary only between turns.
 */
function describeRoom(context: TurnContextInput['lastContext']): string | null {
  if (!context) return null;
  const tokens = context.tokens.toLocaleString('en-GB');
  const { said, tight } = context.window
    ? roomOf(context.tokens, context.window, tokens)
    : {
        said: promptText('turn/context.room-in-tokens', { tokens }),
        tight: context.tokens >= BOT_CONTEXT_TIGHT_TOKENS,
      };
  return tight ? `${said} ${promptText('turn/context.narrow-reads')}` : said;
}

function roomOf(used: number, window: number, tokens: string): { said: string; tight: boolean } {
  const percent = Math.min(100, Math.round((used / window) * 100));
  return {
    said: promptText('turn/context.room-in-percent', {
      percent: String(percent),
      tokens,
      window: window.toLocaleString('en-GB'),
    }),
    tight: percent >= BOT_CONTEXT_TIGHT_PERCENT,
  };
}

/** From this share of the window on, the turn context asks for narrow reads. */
export const BOT_CONTEXT_TIGHT_PERCENT = 50;

/**
 * Where the engine reports no window (the OpenAI engines: the Responses API
 * names none), the tokens alone, and narrow reads from this many on: half
 * the smallest window a bot's provider offers (Claude's 200,000), so a bot
 * whose window is unknown is never told later than one whose window is
 * known (before, such a bot was never told).
 */
export const BOT_CONTEXT_TIGHT_TOKENS = 100_000;

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
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} (${timeZone}, ${offsetLabel(now, timeZone)})`;
}

/**
 * The zone's offset at `now` as "GMT±HH:MM", computed rather than read from
 * ICU's `longOffset`, which spells a zero offset "GMT" or "GMT+00:00"
 * depending on its version.
 */
function offsetLabel(now: Date, timeZone: string): string {
  const wall = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(wall.find((candidate) => candidate.type === type)?.value);
  const wallAsUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
  );
  const minutes = Math.round((wallAsUtc - Math.floor(now.getTime() / 60_000) * 60_000) / 60_000);
  const sign = minutes < 0 ? '-' : '+';
  const hh = String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0');
  const mm = String(Math.abs(minutes) % 60).padStart(2, '0');
  return `GMT${sign}${hh}:${mm}`;
}
