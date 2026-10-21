import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { type BotSection, groupIdOf, inOrder, sectionOrder } from '../lib/bot-groups';

/**
 * The Employees sidebar's sections in the order the reader drags them into,
 * and the drag that changes it. A bot dropped somewhere new is saved there
 * (`groupId` and `position`, the API closing the others up around it): it is
 * drawn where it was dropped while the write is in flight and until the list
 * read again after it lands, and a write that fails puts it back and says so.
 * While a drag is held the sections are the ones the drag layer last
 * published. Spread `handlers` on the sidebar's `DragProvider`.
 */
export function useBotOrder(sections: readonly BotSection[]) {
  const [live, setLive] = useState<SortableGroups | null>(null);
  // The drop's order, drawn until its write settles.
  const [dropped, setDropped] = useState<SortableGroups | null>(null);
  const move = useUpdateBot();
  const order = live ?? dropped;
  const drawn = order ? inOrder(sections, order) : [...sections];

  const handlers = useSortableGroups(
    sectionOrder(drawn),
    (next, { settled }) => setLive(settled ? null : next),
    ({ id, to, index }, next) => {
      setDropped(next);
      move.mutate(
        { id, input: { groupId: groupIdOf(to), position: index } },
        { onSettled: () => setDropped(null) },
      );
    },
  );

  return { sections: drawn, handlers, error: move.error, reset: move.reset };
}
