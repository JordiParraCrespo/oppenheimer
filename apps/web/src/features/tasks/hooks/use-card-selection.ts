import { useEffect, useState } from 'react';
import {
  type CardPick,
  type CardSelection,
  NO_CARD_SELECTION,
  pickCard,
} from '../lib/card-selection';

/**
 * The board's card selection. `order` is the cards as drawn; `picked` is the
 * picked ones the board still draws, in that order, so a card a filter hides
 * or a delete removed is neither counted nor acted on. Escape leaves
 * selection, unless something opened over the board took the key first.
 */
export function useCardSelection(order: readonly string[]) {
  const [selection, setSelection] = useState<CardSelection>(NO_CARD_SELECTION);
  const picked = order.filter((id) => selection.ids.includes(id));
  const selecting = picked.length > 0;

  useEffect(() => {
    if (!selecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setSelection(NO_CARD_SELECTION);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selecting]);

  return {
    picked,
    selecting,
    isPicked: (id: string) => picked.includes(id),
    pick: (id: string, how: CardPick) =>
      setSelection((current) => pickCard(current, id, how, order)),
    /** Leaves exactly `ids` picked: what a marquee touched, or what a bulk delete left to try again. */
    keep: (ids: readonly string[]) =>
      setSelection(ids.length === 0 ? NO_CARD_SELECTION : { ids: [...ids], anchor: null }),
    clear: () => setSelection(NO_CARD_SELECTION),
  };
}
