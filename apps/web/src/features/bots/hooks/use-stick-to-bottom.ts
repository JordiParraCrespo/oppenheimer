import { useStickToBottom as useStickToBottomCore } from '@oppenheimer/design-system-web';
import { useRef } from 'react';

/** A message you sent, carrying its id: a new newest one means you are waiting on the answer. */
const SENT_MESSAGE = '[data-slot="chat-user-message"][data-message-id]';

/**
 * The id of the newest message you sent that `root` shows. An id, not a
 * count: once the conversation fills the API's window, a new message evicts
 * the oldest and the count stays the same.
 */
function newestSent(root: HTMLElement): string | undefined {
  const all = root.querySelectorAll<HTMLElement>(SENT_MESSAGE);
  return all[all.length - 1]?.dataset.messageId;
}

/**
 * The design system's `useStickToBottom`, pinned again when you send: you
 * want to see the answer to what you just asked, so a newest sent message
 * (each `ChatUserMessage` carries `data-message-id`) takes you down even
 * from where you had scrolled to read. `hold` is for the glide of a message
 * you sent (`useSentGlide`).
 */
export function useStickToBottom(): ReturnType<typeof useStickToBottomCore> {
  const sent = useRef<string | undefined>(undefined);
  return useStickToBottomCore({
    repin: (content) => {
      const newest = newestSent(content);
      const changed = newest !== sent.current;
      sent.current = newest;
      return changed;
    },
  });
}
