import { TELEGRAM_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';

/**
 * A reply as Telegram messages: whole when it fits in one, otherwise cut
 * at the last paragraph, line or space before each `max` characters (a hard
 * cut only for a run with none), each part trimmed and none empty.
 */
export function splitTelegramText(text: string, max = TELEGRAM_TEXT_MAX_CHARS): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('\n'),
      window.lastIndexOf(' '),
    );
    const end = cut > max / 2 ? cut : max;
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter((part) => part.length > 0);
}
