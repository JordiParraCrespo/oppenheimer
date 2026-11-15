import { useEffect, useState } from 'react';

/**
 * The rows (or cards) picked for a bulk action, as keys of the pickable ones
 * shown, in `shown`'s order. A key that leaves the list (changed from another
 * tab, filtered out, deleted) leaves the selection with it. A shift-click
 * selects the run from the last one clicked; Escape clears it all. The Inbox
 * and Projects share it, so every bulk list picks the same way.
 */
export function useMultiSelection(shown: readonly string[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const keys = shown.filter((key) => picked.has(key));
  const selected = new Set(keys);
  const any = keys.length > 0;
  // A row that left the list leaves the selection for good, so it is not
  // selected again when a search or filter brings it back.
  if (selected.size !== picked.size) setPicked(selected);

  // Syncs with the document's key events: Escape, while anything is selected.
  useEffect(() => {
    if (!any) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setPicked(new Set());
      setAnchor(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [any]);

  return {
    keys,
    has: (key: string) => selected.has(key),
    any,
    all: any && keys.length === shown.length,
    toggle(key: string, on: boolean, range = false) {
      const from = range && anchor !== null ? shown.indexOf(anchor) : -1;
      const to = shown.indexOf(key);
      const run =
        from >= 0 && to >= 0 ? shown.slice(Math.min(from, to), Math.max(from, to) + 1) : [key];
      const next = new Set(selected);
      for (const each of run) {
        if (on) next.add(each);
        else next.delete(each);
      }
      setPicked(next);
      setAnchor(key);
    },
    toggleAll() {
      setPicked(any && keys.length === shown.length ? new Set() : new Set(shown));
      setAnchor(null);
    },
    /** Keep only these picked: the ones a bulk action failed on. */
    keep(left: readonly string[]) {
      setPicked(new Set(left));
      setAnchor(null);
    },
    clear() {
      setPicked(new Set());
      setAnchor(null);
    },
  };
}

export type MultiSelection = ReturnType<typeof useMultiSelection>;
