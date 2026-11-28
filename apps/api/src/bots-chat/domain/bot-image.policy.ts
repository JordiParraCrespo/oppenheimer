import type { HistoryMessage } from './bot-history.policy';
import { promptText } from './bot-prompt-text.policy';

/**
 * What a turn is told of an earlier message's images: a
 * turn is sent only its own message's images, so an earlier message of
 * yours that carried some says so in its text, with their ids, which
 * `view_image` loads again; one of the bot's says which it showed
 * (`show_image`). The history itself (`botHistory`) reads back whatever text
 * it is given.
 */
export function withEarlierImages(
  message: HistoryMessage & { attachments: readonly { id?: string; name: string }[] },
  canView: boolean,
): HistoryMessage {
  const { role, content, event, steps, attachments } = message;
  // The reactions ride along whatever the images say (`reactionNotes`).
  const reactions = {
    reaction: message.reaction ?? null,
    botReaction: message.botReaction ?? null,
  };
  if (attachments.length === 0) return { role, content, event, steps, ...reactions };
  const note =
    role === 'user'
      ? imagesNote(attachments, canView)
      : role === 'assistant'
        ? shownNote(attachments.map((attachment) => attachment.name))
        : null;
  if (!note) return { role, content, event, steps, ...reactions };
  return {
    role,
    content: [content.trim(), note].filter(Boolean).join('\n\n'),
    event,
    ...reactions,
  };
}

/** The sentence that stands for the images the bot showed the person here. */
function shownNote(names: readonly string[]): string {
  const listed = names.map((name) => `"${name}"`).join(', ');
  return promptText('core/turn-images.shown', {
    namesCount: names.length === 1 ? 'an image' : `${names.length} images`,
    listed,
  });
}

/**
 * Room the history keeps for the notes `withEarlierImages` adds to earlier
 * messages (15 to 50 tokens each), which the summary's fold does not count:
 * the fold starts this much below the budget (`BOT_SUMMARY_TRIGGER_TOKENS`).
 * A note that grows past this, or a chat with many more images in view,
 * needs it raised.
 */
export const EARLIER_IMAGES_HEADROOM_TOKENS = 1_000;

/**
 * The sentence that stands for images the bot was sent before and is not
 * sent now, with their ids, which a mail tool attaches. On a turn offered
 * `view_image` (`canView`) it says to look again with that tool; on any
 * other it says the bot cannot see them, so it never names a tool the turn
 * does not have.
 */
export function imagesNote(
  images: readonly { id?: string; name: string }[],
  canView: boolean,
): string {
  const count = images.length;
  const [what, them] = count === 1 ? ['an image', 'it'] : [`${count} images`, 'them'];
  return promptText(
    canView ? 'core/turn-images.came-with' : 'core/turn-images.came-with-unviewable',
    { what, ids: idsOf(images), them },
  );
}

/**
 * The sentence after this turn's own message when it carries images: their
 * ids, which a mail tool's `attachments` takes as `chat_image` to send them on.
 */
export function attachedImagesNote(images: readonly { id: string; name: string }[]): string {
  if (images.length === 0) return '';
  return promptText('core/turn-images.attached', { ids: idsOf(images) });
}

/** `: "a.png" (image id …), …`, or nothing when no image has an id. */
function idsOf(images: readonly { id?: string; name: string }[]): string {
  const named = images.flatMap((image) =>
    image.id ? [`"${image.name}" (image id ${image.id})`] : [],
  );
  return named.length ? `: ${named.join(', ')}` : '';
}
