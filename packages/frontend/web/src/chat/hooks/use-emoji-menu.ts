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

/** The menu's width in pixels (`w-72`), to keep it inside the box it opens over. */
const MENU_WIDTH = 288;

let measure: CanvasRenderingContext2D | null = null;

/**
 * How far from the box's left edge the shortcode's colon sits in `field`, the
 * width of the line's text before it in the field's own font; a line that
 * wraps is measured on the row the colon is on. Clamped so a menu of
 * `MENU_WIDTH` stays inside the box.
 */
function colonLeft(field: HTMLTextAreaElement, box: HTMLElement, start: number): number {
  measure ??= document.createElement('canvas').getContext('2d');
  const style = getComputedStyle(field);
  const padding = Number.parseFloat(style.paddingLeft) || 0;
  const room = field.clientWidth - padding - (Number.parseFloat(style.paddingRight) || 0);
  const line = field.value.slice(field.value.lastIndexOf('\n', start - 1) + 1, start);
  let x = 0;
  if (measure) {
    measure.font = style.font;
    x = measure.measureText(line).width;
  }
  if (room > 0) x %= room;
  const left = field.getBoundingClientRect().left - box.getBoundingClientRect().left + padding + x;
  return Math.max(0, Math.min(left, box.clientWidth - MENU_WIDTH));
}

/**
 * A composer's `:` menu: while a shortcode is being typed before the caret
 * (`:hap`), the emoji it may mean, picked the way the `/` menu picks
 * (`useCommandMenu`: Up and Down, Tab or Enter, Escape). A pick puts the
 * emoji in the shortcode's place and the caret after it. The menu opens over
 * the shortcode's colon, as Claude Code's does, not across the whole box.
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
  const [left, setLeft] = useState(0);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const typed = emojiQuery(draft, caret);

  function onCaret(event: SyntheticEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    field.current = target;
    const at = target.selectionStart === target.selectionEnd ? target.selectionStart : null;
    setCaret(at);
    const open = emojiQuery(target.value, at);
    if (!open) return;
    setLeft(colonLeft(target, event.currentTarget, open.start));
    if (!emoji) loadEmoji().then(setEmoji, () => undefined);
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
    /** Where the menu opens, in pixels from the box's left edge: over the colon. */
    left,
    highlighted: menu.highlighted,
    pick: menu.pick,
    onKeyDownCapture,
    track: { onInput: onCaret, onSelect: onCaret, onKeyUp: onCaret, onMouseUp: onCaret, onBlur },
  };
}
