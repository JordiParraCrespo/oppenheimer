import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import type { SlashCommand } from '../lib/command-menu';

/**
 * A composer's `/` menu over its draft: while `query` is a command being
 * typed (the caller reads it off the draft, by its own grammar), the rows
 * `rowsFor` gives for it, in groups whose order is the keyboard's. Up and
 * Down move through every row, Tab or Enter picks one, Escape closes the
 * menu for that draft. The highlight belongs to what was typed, so a new
 * letter starts it at the top again with no effect to reset it.
 */
export function useCommandMenu<Groups extends Record<string, readonly SlashCommand[]>>({
  draft,
  query,
  rowsFor,
  onPick,
}: {
  draft: string;
  query: string | null;
  rowsFor: (query: string) => Groups;
  onPick: (command: SlashCommand) => void;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ query: string; index: number } | null>(null);
  const groups = query !== null && dismissed !== draft ? rowsFor(query) : null;
  const items = groups ? Object.values(groups).flat() : [];
  const open = items.length > 0;
  const index =
    highlight && highlight.query === query ? Math.min(highlight.index, items.length - 1) : 0;

  function onKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
    if (!open || query === null) return;
    const move = (by: number) =>
      setHighlight({ query, index: (index + by + items.length) % items.length });
    const handled: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Tab: () => items[index] && onPick(items[index]),
      Enter: () => items[index] && onPick(items[index]),
      Escape: () => setDismissed(draft),
    };
    const action = event.shiftKey ? undefined : handled[event.key];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  return { open, groups: open ? groups : null, highlighted: index, pick: onPick, onKeyDownCapture };
}
