import { type RefObject, useRef, useState } from 'react';
import type { ChatFindTarget } from '../lib/chat-find';
import { useChatFindHighlights } from './use-chat-find-highlights';
import { useFindKey } from './use-find-key';

/**
 * The session chat's find, as the chat composes it: what it is on (none while
 * it is closed), opened by the key with focus inside `root` (a second press
 * selects what is typed), painted and scrolled to in `scroller`. A hit moves
 * the reader, so the chat stops following its end (`leave`) and draws the
 * turn the hit is in (`draw`, the chat's own window policy). `found` is the
 * turn the find is on, which stays open so the match is drawn.
 */
export function useChatFind({
  root,
  scroller,
  leave,
  draw,
}: {
  root: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  leave: () => void;
  draw: (turnId: string) => void;
}): {
  find: ChatFindTarget | null;
  found: string | null;
  input: RefObject<HTMLInputElement | null>;
  onFind: (target: ChatFindTarget) => void;
  close: () => void;
} {
  const [find, setFind] = useState<ChatFindTarget | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useChatFindHighlights(scroller, find?.query ?? null, find?.hit ?? null);
  useFindKey(root, () => {
    if (find) input.current?.select();
    else setFind({ query: '', hit: null });
  });
  const onFind = (target: ChatFindTarget) => {
    if (target.hit) {
      leave();
      draw(target.hit.turnId);
    }
    setFind(target);
  };
  return { find, found: find?.hit?.turnId ?? null, input, onFind, close: () => setFind(null) };
}
