/**
 * The sessions the reader marked unread to come back to later, kept on this
 * device the way the pins are (`session-pins.ts`): their ids. A mark is the
 * reader's, not the session's, so the API never hears of it; opening the
 * session takes it off.
 */
export const SESSION_UNREAD_KEY = 'oppenheimer.sidebar.unread';

/** `marks` with `id` marked unread, or read. */
export function withUnread(marks: readonly string[], id: string, unread: boolean): string[] {
  const rest = marks.filter((markedId) => markedId !== id);
  return unread ? [id, ...rest] : rest;
}
