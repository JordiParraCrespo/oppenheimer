import type { BotMessageRole } from '@oppenheimer/shared';
import { estimateTokens } from './bot-history.policy';
import { promptText } from './bot-prompt-text.policy';
import { neutraliseTags } from './bot-tool-text.policy';

/** A message as the suggestion reads it. */
export interface SuggestionMessage {
  id: string;
  role: BotMessageRole;
  content: string;
}

/**
 * How many of the chat's newest messages the suggestion reads. Activity lines
 * are among them and are left out of what is sent, so this leaves room for a
 * dozen messages of words after a turn of many tool calls.
 */
export const BOT_SUGGESTION_READ_MAX = 40;

/** How much of the conversation's end the suggestion is sent: enough for what was just said, no more. */
const BOT_SUGGESTION_TRANSCRIPT_TOKENS = 4_000;

/** The longest suggestion the composer shows; a longer answer is not a message someone types. */
export const BOT_SUGGESTION_MAX = 200;

/** Who said a message, as the suggestion's transcript names them. */
const SPEAKERS: Partial<Record<BotMessageRole, string>> = {
  user: 'person',
  assistant: 'bot',
};

/** The suggester's system prompt: one short next message, or NONE, and the conversation is data. */
export const BOT_SUGGESTER_PROMPT = promptText('core/job-suggestion.system');

/**
 * The message a suggestion is for: the bot's last words, when they are the
 * conversation's newest message. Null when the person spoke last, or an
 * event did (a turn is coming), or nothing has been said: there is nothing to
 * answer yet.
 */
export function suggestionAnchor(messages: readonly SuggestionMessage[]): SuggestionMessage | null {
  const last = messages.filter((message) => message.role !== 'activity').at(-1);
  return last?.role === 'assistant' && last.content.trim() ? last : null;
}

/**
 * What the suggester is asked: the person's and the bot's newest words that
 * fit `BOT_SUGGESTION_TRANSCRIPT_TOKENS`, oldest first, each fenced as data.
 * The bot's last message is always sent, cut from its start when it alone is
 * past the budget, since its end is what the person answers.
 */
export function composeSuggestionRequest(messages: readonly SuggestionMessage[]): string {
  const blocks: string[] = [];
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const speaker = SPEAKERS[message.role];
    const text = message.content.trim();
    if (!speaker || !text) continue;
    const room = BOT_SUGGESTION_TRANSCRIPT_TOKENS - used;
    const kept =
      blocks.length === 0 && estimateTokens(text) > room ? `…${text.slice(-(room - 1) * 4)}` : text;
    used += estimateTokens(kept);
    if (used > BOT_SUGGESTION_TRANSCRIPT_TOKENS) break;
    blocks.push(`<${speaker}>\n${escapeTags(kept)}\n</${speaker}>`);
  }
  return promptText('core/job-suggestion.request', { messages: blocks.reverse().join('\n') });
}

/**
 * The suggestion the composer shows, or null when the answer is not one: the
 * model said NONE, or wrote nothing, more than one line or more than
 * `BOT_SUGGESTION_MAX` characters. Quotes the model put around it are taken off.
 */
export function suggestionText(answer: string): string | null {
  const text = answer
    .trim()
    .replace(/^(["'“‘`])(.*)(["'”’`])$/s, '$2')
    .trim();
  if (!text || /^none\.?$/i.test(text)) return null;
  if (text.includes('\n') || text.length > BOT_SUGGESTION_MAX) return null;
  return text;
}

function escapeTags(text: string): string {
  return neutraliseTags(text, ['messages', ...Object.values(SPEAKERS)]);
}
