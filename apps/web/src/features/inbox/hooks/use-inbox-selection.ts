import { useEffect, useState } from 'react';

/**
 * The rows picked for a bulk action, as keys of the open rows shown. A key
 * that leaves the list (marked from another tab, filtered out) leaves the
 * selection with it. A shift-click selects the run from the last row clicked;
 * Escape clears it all.
 */
export function useInboxSelection(shown: readonly string[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const keys = shown.filter((key) => picked.has(key));
  const selected = new Set(keys);
  const any = keys.length > 0;

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
    clear() {
      setPicked(new Set());
      setAnchor(null);
    },
  };
}

export type InboxSelection = ReturnType<typeof useInboxSelection>;
