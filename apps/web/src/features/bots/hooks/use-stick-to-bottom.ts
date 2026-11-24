import { useStickToBottom as useStickToBottomCore } from '@oppenheimer/design-system-web';
import { useRef } from 'react';

/**
 * The id of the newest message you sent that `root` shows, as the transcript
 * names it (`data-newest-sent`): a new one means you are waiting on the
 * answer. An id, not a count: once the conversation fills the API's window, a
 * new message evicts the oldest and the count stays the same. Named by the
 * transcript, not read off the last message drawn, so a message of yours in
 * an older page laid above never counts as just sent.
 */
function newestSent(root: HTMLElement): string | undefined {
  return root.querySelector<HTMLElement>('[data-newest-sent]')?.dataset.newestSent;
}

/**
 * The design system's `useStickToBottom`, pinned again when you send: you
 * want to see the answer to what you just asked, so a newest sent message
 * (the transcript's `data-newest-sent`) takes you down even
 * from where you had scrolled to read. `hold` is for the glide of a message
 * you sent (`useSentGlide`).
 */
export function useStickToBottom(): ReturnType<typeof useStickToBottomCore> {
  const sent = useRef<string | undefined>(undefined);
  return useStickToBottomCore({
    repin: (content) => {
      const newest = newestSent(content);
      // A send names a message; the name going away (your last message slid
      // out of the window into older history) is no send.
      const changed = newest !== undefined && newest !== sent.current;
      sent.current = newest;
      return changed;
    },
  });
}
