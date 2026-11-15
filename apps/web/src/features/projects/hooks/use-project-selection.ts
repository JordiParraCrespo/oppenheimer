import { useEffect, useState } from 'react';

/**
 * The project cards picked for a bulk action, as ids of the pickable cards
 * shown. An id that leaves the list (deleted from another tab, or held by a
 * session that just opened) leaves the selection with it. A shift-click picks
 * the run from the last card toggled; Escape clears it all.
 */
export function useProjectSelection(pickable: readonly string[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const ids = pickable.filter((id) => picked.has(id));
  const selected = new Set(ids);
  const any = ids.length > 0;
  if (selected.size !== picked.size) setPicked(selected);

  // Syncs with the document's key events: Escape, while anything is picked.
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
    ids,
    has: (id: string) => selected.has(id),
    any,
    all: any && ids.length === pickable.length,
    toggle(id: string, on: boolean, range = false) {
      const from = range && anchor !== null ? pickable.indexOf(anchor) : -1;
      const to = pickable.indexOf(id);
      const run =
        from >= 0 && to >= 0 ? pickable.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
      const next = new Set(selected);
      for (const each of run) {
        if (on) next.add(each);
        else next.delete(each);
      }
      setPicked(next);
      setAnchor(id);
    },
    toggleAll() {
      setPicked(any && ids.length === pickable.length ? new Set() : new Set(pickable));
      setAnchor(null);
    },
    /** Keep only these picked: the ones a bulk delete failed on. */
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
