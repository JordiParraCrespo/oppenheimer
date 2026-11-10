import { splitReplyText } from '@oppenheimer/shared';
import { TELEGRAM_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';

/** A reply as Telegram messages: `splitReplyText` at Telegram's limit. */
export function splitTelegramText(text: string, max = TELEGRAM_TEXT_MAX_CHARS): string[] {
  return splitReplyText(text, max);
}
