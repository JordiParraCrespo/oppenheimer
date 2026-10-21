import type { HistoryMessage } from './bot-history.policy';

/**
 * What a turn is told of an earlier message's images (`25-bots.md` §3.1): a
 * turn is sent only its own message's images, so an earlier message that
 * carried some says so in its text, and that the bot cannot see them now.
 * The history itself (`botHistory`) reads back whatever text it is given.
 */
export function withEarlierImages(
  message: HistoryMessage & { attachments: readonly unknown[] },
): HistoryMessage {
  const { role, content, event, attachments } = message;
  if (role !== 'user' || attachments.length === 0) return { role, content, event };
  return {
    role,
    content: [content.trim(), imagesNote(attachments.length)].filter(Boolean).join('\n\n'),
    event,
  };
}

/** The sentence that stands for `count` images the bot was sent before and cannot see now. */
export function imagesNote(count: number): string {
  const [images, them] = count === 1 ? ['an image', 'it'] : [`${count} images`, 'them'];
  return `[Oppenheimer: this message came with ${images}. Only a turn's own images are sent, so you cannot see ${them} now; if you need ${them} again, ask the person to send ${them} again.]`;
}
