import type { BotPeerMessageEvent, BotPeerReplyEvent, BotReplyOutcome } from '@oppenheimer/shared';
import { promptText } from './bot-prompt-text.policy';

/**
 * Messages between bots, as rules: what may be sent, how
 * the receiving bot reads it, and what goes back as an answer. Pure.
 *
 * A message from another bot is information, never an instruction with the
 * person's authority (the system prompt's rules say so, and the envelope here
 * marks it every time it is read). The sender is the bot Oppenheimer
 * recorded, so the envelope names it from the event, never from the words.
 */

/** How many messages and asks one turn may send to other bots. */
export const BOT_PEER_MESSAGES_PER_TURN = 5;

/** The longest answer an ask carries back; a longer one is cut, the cut marked. */
export const BOT_PEER_ANSWER_MAX = 8_000;

/**
 * Credentials a message between bots must never carry, by the shapes their
 * issuers give them. A match refuses the message: a key passed from bot to
 * bot is a key the person did not hand out.
 */
const SECRET_SHAPES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'a private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'an Anthropic API key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'an OpenAI API key', pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/ },
  {
    name: 'a GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/,
  },
  { name: 'a Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'an AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'a Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: 'a signed token (JWT)',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/,
  },
];

/** What kind of credential `text` holds, in words; null when it holds none Oppenheimer knows. */
export function secretIn(text: string): string | null {
  return SECRET_SHAPES.find((shape) => shape.pattern.test(text))?.name ?? null;
}

/** What the sending bot is told when nothing was sent, by reason, in words it can act on. */
export const PEER_REFUSALS = {
  notRunning: promptText('bots/tools-peer-messages.refused-turn-not-running'),
  noAccount: promptText('bots/tools-peer-messages.refused-no-account'),
  chainGone: promptText('bots/tools-peer-messages.refused-chain-gone'),
  deleted: (name: string) => `${name} was deleted.`,
  noKey: (name: string, provider: string) =>
    promptText('bots/tools-peer-messages.refused-no-key', { name, provider }),
} as const;

/** The tool's answer when a message holds a credential: nothing was sent, and why. */
export function secretRefusal(kind: string): string {
  return promptText('bots/tools-peer-messages.refused-secret', { kind });
}

/**
 * A bot's message to another, as the receiving bot reads it, now and in its
 * history: who sent it as Oppenheimer recorded them, whether they wait for an
 * answer, and the words inside a tag the words cannot close.
 */
export function peerMessageNote(event: BotPeerMessageEvent, content: string): string {
  const from = senderOf(event.fromBotName, event.fromBotId);
  const asks = event.expectsReply
    ? promptText('bots/wake-peer-message.asked-and-waiting', { from })
    : promptText('bots/wake-peer-message.sent-not-waiting', { from });
  return `${promptText('bots/wake-peer-message.message-note', { asks })}
<bot_message from="${attribute(event.fromBotName)}">
${enclose(content, 'bot_message')}
</bot_message>`;
}

/** The answer to an ask, as the asking bot reads it. */
export function peerReplyNote(event: BotPeerReplyEvent, content: string): string {
  const from = senderOf(event.fromBotName, event.fromBotId);
  const how = {
    answered: promptText('bots/wake-peer-message.answered', { from }),
    failed: promptText('bots/wake-peer-message.failed', { from }),
    cancelled: promptText('bots/wake-peer-message.cancelled', { from }),
  }[event.outcome];
  return `${promptText('bots/wake-peer-message.reply-note', { how })}
<bot_reply from="${attribute(event.fromBotName)}">
${enclose(content, 'bot_reply')}
</bot_reply>`;
}

/**
 * What a turn opened by another bot's message is asked: the message, then
 * how to treat it. Its final message is what goes back when it was asked.
 */
export function peerMessagePrompt(event: BotPeerMessageEvent, content: string): string {
  const name = event.fromBotName;
  const reply = event.expectsReply
    ? promptText('bots/wake-peer-message.your-answer-goes-back', { name })
    : promptText('bots/wake-peer-message.nothing-goes-back', { name });
  return `${peerMessageNote(event, content)}

${promptText('bots/wake-peer-message.ask', { reply })}`;
}

/** What a turn opened by the answer to an ask is asked. */
export function peerReplyPrompt(event: BotPeerReplyEvent, content: string): string {
  return `${peerReplyNote(event, content)}

${promptText('bots/wake-peer-message.ask-on-reply')}`;
}

/**
 * The answer an ask carries back from the turn it opened: that turn's last
 * text when it ended with one, else what happened to it.
 */
export function peerAnswerOf(
  turn: { status: string; error: string | null },
  texts: readonly string[],
): { outcome: BotReplyOutcome; content: string } {
  const last = [...texts].reverse().find((text) => text.trim()) ?? null;
  if (turn.status === 'failed') {
    return { outcome: 'failed', content: turn.error ?? 'The turn failed.' };
  }
  if (turn.status === 'cancelled') {
    return {
      outcome: 'cancelled',
      content: last ? fit(last) : promptText('bots/tools-peer-messages.answer-stopped'),
    };
  }
  return {
    outcome: 'answered',
    content: last ? fit(last) : promptText('bots/tools-peer-messages.answer-empty'),
  };
}

function senderOf(name: string, id: string | null): string {
  const safe = attribute(name);
  return id
    ? promptText('bots/wake-peer-message.sender', { name: safe, id })
    : promptText('bots/wake-peer-message.sender-since-deleted', { name: safe });
}

/**
 * A bot's name as the envelope quotes it: no quote, bracket or line break
 * survives, so a name (which another bot may have chosen) can neither end
 * the quote nor start a line that looks like Oppenheimer's.
 */
function attribute(name: string): string {
  return name.replace(/["<>[\]\r\n]/g, '');
}

/** The words, with every closing tag of the envelope defused, so the content stays inside it. */
function enclose(content: string, tag: string): string {
  return content.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
}

function fit(text: string): string {
  if (text.length <= BOT_PEER_ANSWER_MAX) return text;
  return `${text.slice(0, BOT_PEER_ANSWER_MAX - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}
