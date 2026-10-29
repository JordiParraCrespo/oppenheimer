import type { HistoryMessage } from './bot-history.policy';

/**
 * What a turn is told of an earlier message's images (`25-bots.md` §3.1): a
 * turn is sent only its own message's images, so an earlier message of
 * yours that carried some says so in its text, and that the bot cannot see
 * them now; one of the bot's says which it showed (`show_image`, §4.7). The
 * history itself (`botHistory`) reads back whatever text it is given.
 */
export function withEarlierImages(
  message: HistoryMessage & { attachments: readonly { id?: string; name: string }[] },
): HistoryMessage {
  const { role, content, event, attachments } = message;
  if (attachments.length === 0) return { role, content, event };
  const note =
    role === 'user'
      ? imagesNote(attachments)
      : role === 'assistant'
        ? shownNote(attachments.map((attachment) => attachment.name))
        : null;
  if (!note) return { role, content, event };
  return { role, content: [content.trim(), note].filter(Boolean).join('\n\n'), event };
}

/** The sentence that stands for the images the bot showed the person here. */
function shownNote(names: readonly string[]): string {
  const listed = names.map((name) => `"${name}"`).join(', ');
  return `[Oppenheimer: here you showed the person ${names.length === 1 ? 'an image' : `${names.length} images`} with show_image: ${listed}.]`;
}

/**
 * The sentence that stands for images the bot was sent before and cannot see
 * now, with their ids, which a mail tool can still attach.
 */
export function imagesNote(images: readonly { id?: string; name: string }[]): string {
  const count = images.length;
  const [what, them] = count === 1 ? ['an image', 'it'] : [`${count} images`, 'them'];
  return `[Oppenheimer: this message came with ${what}${idsOf(images)}. Only a turn's own images are sent, so you cannot see ${them} now; if you need to look at ${them} again, ask the person to send ${them} again.]`;
}

/**
 * The sentence after this turn's own message when it carries images: their
 * ids, which a mail tool's `attachments` takes as `chat_image` to send them on.
 */
export function attachedImagesNote(images: readonly { id: string; name: string }[]): string {
  if (images.length === 0) return '';
  return `[Oppenheimer: the images with this message${idsOf(images)}; to attach one to mail, give its id as chat_image.]`;
}

/** `: "a.png" (image id …), …`, or nothing when no image has an id. */
function idsOf(images: readonly { id?: string; name: string }[]): string {
  const named = images.flatMap((image) =>
    image.id ? [`"${image.name}" (image id ${image.id})`] : [],
  );
  return named.length ? `: ${named.join(', ')}` : '';
}
