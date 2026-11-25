import type { BotPermission } from '@oppenheimer/shared';
import { peelReplyMarks } from './bot-reply-mark.policy';
import { rulesToReview } from './bot-rule-review.policy';
import { type BotPermissions, grantFor, toolDecision } from './bot-tool-permission.policy';

/** The tool whose permission a spoken reply rides on: what speaks for the owner in a chat. */
export const VOICE_REPLY_TOOL = 'send_whatsapp_voice_note';

/**
 * Whether a contact's turn in this chat may answer as a voice note: exactly
 * where `send_whatsapp_voice_note` would run there without a card, a standing
 * grant for this number's chat or the tool allowed outright with no ask rule
 * for its call to be read against, and never where it is off. Allowing a chat for text, or the chat for this bot to answer,
 * allows no voice: the owner's voice is its own permission.
 */
export function voiceReplyAllowed(
  permissions: BotPermissions,
  preset: BotPermission,
  chat: { whatsappAccountId: string; chatId: string },
): boolean {
  const tool = { name: VOICE_REPLY_TOOL, asks: true, perCallOnly: false };
  const decision = toolDecision(permissions, tool, preset);
  if (decision === 'off') return false;
  // The tool on Allow still has its call read against the owner's ask
  // rules; a reply has no card to raise, so any ask rule keeps it text.
  if (decision === 'allow') return rulesToReview(permissions, 'allow').length === 0;
  const subject = {
    kind: 'whatsapp_chat',
    key: `${chat.whatsappAccountId}:${chat.chatId}`,
    label: chat.chatId,
  };
  return grantFor(permissions, tool, subject) !== null;
}

/** How a contact turn's reply goes: the words to send, and whether they are spoken. */
export interface VoiceReplyChoice {
  text: string;
  spoken: boolean;
}

/** What is read rather than heard: a link, code, or a list to scan. */
const READ_NOT_HEARD = /https?:\/\/|www\.|`|^\s*(?:[-*•]|\d+[.)])\s/m;

/**
 * How a contact turn's reply goes out: spoken only when the bot opened it
 * with `VOICE_REPLY_MARK` (`peelReplyMarks`), the chat allows it
 * (`voiceReplyAllowed`), and the
 * words are short enough to speak and meant to be heard. Anything else is
 * text, the mark taken off, so a refused or unspeakable voice reply still
 * reaches the chat once, as words.
 */
export function voiceReplyChoice(
  reply: string,
  allowed: boolean,
  maxChars: number,
): VoiceReplyChoice {
  const { voice: marked, text } = peelReplyMarks(reply);
  const speakable =
    text.length > 0 && Array.from(text).length <= maxChars && !READ_NOT_HEARD.test(text);
  return { text, spoken: marked && allowed && speakable };
}
