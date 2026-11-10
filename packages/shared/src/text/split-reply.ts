/**
 * A reply as a channel's messages (Telegram's, WhatsApp's): whole when it
 * fits in one, otherwise cut at the last paragraph, line or space before
 * each `max` characters (a hard cut only for a run with none, never through
 * a character such as an emoji that takes two UTF-16 units), each part
 * trimmed and none empty.
 */
export function splitReplyText(text: string, max: number): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('\n'),
      window.lastIndexOf(' '),
    );
    const end = cut > max / 2 ? cut : hardCut(rest, max);
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter((part) => part.length > 0);
}

/** `max`, or one less when that would split a surrogate pair. */
function hardCut(text: string, max: number): number {
  const last = text.charCodeAt(max - 1);
  return last >= 0xd800 && last <= 0xdbff ? max - 1 : max;
}
