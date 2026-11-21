import type { KeyboardEvent, SyntheticEvent } from 'react';
import { useRef, useState } from 'react';
import {
  type EmojiRow,
  emojiQuery,
  insertEmoji,
  loadEmoji,
  matchingEmoji,
} from '../lib/emoji-menu';
import { useCommandMenu } from './use-command-menu';

/**
 * A composer's `:` menu: while a shortcode is being typed before the caret
 * (`:hap`), the emoji it may mean, picked the way the `/` menu picks
 * (`useCommandMenu`: Up and Down, Tab or Enter, Escape). A pick puts the
 * emoji in the shortcode's place and the caret after it.
 *
 * The caret is read from the field's own events, which bubble to the box
 * that spreads `track` (`onInput`, `onSelect`, `onKeyUp`, `onMouseUp`), so
 * any composer's textarea serves without handing its ref up. The menu takes
 * only the field's keys, and closes when the field loses focus. The list of
 * emoji is fetched the first time a shortcode is typed.
 */
export function useEmojiMenu(draft: string, setDraft: (next: string) => void) {
  const [caret, setCaret] = useState<number | null>(null);
  const [emoji, setEmoji] = useState<readonly EmojiRow[] | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const typed = emojiQuery(draft, caret);

  function onCaret(event: SyntheticEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    field.current = target;
    const at = target.selectionStart === target.selectionEnd ? target.selectionStart : null;
    setCaret(at);
    if (!emoji && emojiQuery(target.value, at)) {
      loadEmoji().then(setEmoji, () => undefined);
    }
  }

  // The field leaving focus (the mic's recorder, a chip) closes the menu, so its keys stay theirs.
  function onBlur(event: SyntheticEvent<HTMLElement>) {
    if (event.target instanceof HTMLTextAreaElement) setCaret(null);
  }

  // Only a key in the field is the menu's: Enter on the recorder or a chip in the box stays theirs.
  function onKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
    if (event.target instanceof HTMLTextAreaElement) menu.onKeyDownCapture(event);
  }

  const menu = useCommandMenu<EmojiRow>({
    draft,
    query: emoji && typed ? typed.query : null,
    rowsFor: (query) => ({ emoji: matchingEmoji(emoji ?? [], query) }),
    onPick: (row) => {
      if (!typed || caret === null) return;
      const next = insertEmoji(draft, { start: typed.start, caret }, row.emoji);
      setDraft(next.text);
      setCaret(next.caret);
      // After the new text has rendered, so the caret is not left at its end.
      requestAnimationFrame(() => {
        field.current?.focus();
        field.current?.setSelectionRange(next.caret, next.caret);
      });
    },
  });

  return {
    rows: menu.groups?.emoji ?? null,
    highlighted: menu.highlighted,
    pick: menu.pick,
    onKeyDownCapture,
    track: { onInput: onCaret, onSelect: onCaret, onKeyUp: onCaret, onMouseUp: onCaret, onBlur },
  };
}
