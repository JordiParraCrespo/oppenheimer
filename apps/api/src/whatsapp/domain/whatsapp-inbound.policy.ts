import type { WhatsappMessageDraft } from './whatsapp-message.types';
import { sameWhatsappNumber } from './whatsapp-number.policy';

/** What the owner's message asks of the chat's bot. `help` is answered with a fixed line. */
export type WhatsappOwnerCommand = 'message' | 'new' | 'stop' | 'help';

/**
 * What a message a linked number received comes to
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §2):
 *
 * - `owner`: the confirmed owner wrote from their own number. `switchName`
 *   is the name a "Name: …" message starts with, still to be matched against
 *   their bots; `text` is then what follows it (empty for a bare "Name:").
 * - `ignore`: everything else, which is stored for the bots to read and
 *   nothing more: the number's own messages (`fromMe`, what is typed on the
 *   spare phone or what a bot sent), groups, the number's chat with itself,
 *   anyone who is not the owner, and everyone while no owner is confirmed.
 *   A stranger gets no line on WhatsApp.
 */
export type WhatsappInboundAction =
  | { kind: 'owner'; command: WhatsappOwnerCommand; text: string; switchName: string | null }
  | { kind: 'ignore' };

/** What the account knows of who may talk: its own number and its confirmed owner's. */
export interface WhatsappInboundAccount {
  phone: string | null;
  ownerPhone: string | null;
}

/** The owner's `/help`; names the chat's bot when one answers. */
export function whatsappHelpLine(botName: string | null): string {
  const who = botName ? `${botName} answers here.` : 'No bot answers here yet.';
  return `${who} Write to me and I answer. "Name: …" talks to another of your bots; /new starts a fresh conversation; /stop stops what I am doing.`;
}

/** Sent when the owner writes and no Oppenheimer bot answers the chat. */
export const WHATSAPP_NO_BOT_LINE =
  'No bot answers here yet. Choose one in Oppenheimer, under Settings → WhatsApp.';

/** Sent when `/new` closed the conversation. */
export const WHATSAPP_NEW_LINE = 'Started a new conversation.';

/** Sent when `/stop` asked the running turn to stop. */
export const WHATSAPP_STOP_LINE = 'Stopping.';

/** Sent when a bare "Name:" switched the chat to that bot. */
export function whatsappSwitchedLine(botName: string): string {
  return `Now talking to ${botName}.`;
}

/** The commands, typed as the whole message, ignoring case. */
const COMMANDS: Readonly<Record<string, Exclude<WhatsappOwnerCommand, 'message'>>> = {
  '/new': 'new',
  '/stop': 'stop',
  '/help': 'help',
};

/**
 * "Shop: what sold?": a name of up to 80 characters, a colon, and the rest
 * (which may run over lines). Whether the name is a bot's is the resolver's
 * to say; one that is not leaves the message as it was written.
 */
const SWITCH = /^\s*([^:\n]{1,80}?)\s*:\s*(.*)$/s;

/** What one received message comes to, for an account that knows `account`. */
export function whatsappInboundAction(
  account: WhatsappInboundAccount,
  message: Pick<
    WhatsappMessageDraft,
    'chatId' | 'chatKind' | 'fromMe' | 'senderId' | 'text' | 'media'
  >,
): WhatsappInboundAction {
  if (message.fromMe || message.chatKind !== 'direct') return { kind: 'ignore' };
  if (account.phone !== null && message.chatId === account.phone) return { kind: 'ignore' };
  // The owner's own direct chat: the answer goes back where it came from.
  const owner = account.ownerPhone;
  if (
    owner === null ||
    !sameWhatsappNumber(message.senderId, owner) ||
    !sameWhatsappNumber(message.chatId, owner)
  ) {
    return { kind: 'ignore' };
  }
  const text = message.text.trim() || (message.media ? `[${message.media}]` : '');
  if (!text) return { kind: 'ignore' };
  const lowered = text.toLowerCase();
  const command = Object.hasOwn(COMMANDS, lowered) ? COMMANDS[lowered] : undefined;
  if (command) return { kind: 'owner', command, text: '', switchName: null };
  const switched = SWITCH.exec(text);
  const name = switched?.[1]?.trim();
  if (switched && name) {
    return { kind: 'owner', command: 'message', text: switched[2]?.trim() ?? '', switchName: name };
  }
  return { kind: 'owner', command: 'message', text, switchName: null };
}
