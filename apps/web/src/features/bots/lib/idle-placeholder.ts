/**
 * What the empty composer invites, one line among several so the box does
 * not read the same every time it opens.
 */
export const IDLE_PLACEHOLDERS = [
  'takeOn',
  'job',
  'problem',
  'session',
  'listening',
  'anything',
] as const;

/**
 * The line for this bot on this visit: `salt` is drawn once when the
 * composer mounts, so it holds while the chat is open and differs between
 * bots and between visits.
 */
export function idlePlaceholder(botId: string, salt: number): (typeof IDLE_PLACEHOLDERS)[number] {
  let hash = Math.trunc(salt);
  for (const char of botId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return IDLE_PLACEHOLDERS[Math.abs(hash) % IDLE_PLACEHOLDERS.length] ?? IDLE_PLACEHOLDERS[0];
}
