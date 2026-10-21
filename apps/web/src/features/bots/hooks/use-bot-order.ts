import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { botSections, groupIdOf, inOrder, sectionOrder } from '../lib/bot-groups';

/**
 * The Employees sidebar's sections in the order the reader drags them into,
 * and the drag that changes it. A bot dropped somewhere new is saved there
 * (`groupId` and `position`, the API closing the others up around it): it is
 * drawn where it was dropped while the write is in flight and until the list
 * read again after it lands, and a write that fails puts it back and says so.
 * While a drag is held the sections are the ones the drag layer last
 * published, and Ungrouped is drawn even with no bot, so a bot can always
 * be dragged out of its group. Spread `handlers` on the sidebar's
 * `DragProvider`.
 */
export function useBotOrder(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  term: string,
) {
  const [dragging, setDragging] = useState(false);
  // The groups the drag layer last published while a drag is held, then the
  // drop's until its write settles; `null` is the server's order.
  const [order, setOrder] = useState<SortableGroups | null>(null);
  const move = useUpdateBot();
  const sections = botSections(bots, groups, term, { keepUngrouped: dragging });
  const drawn = order ? inOrder(sections, order) : sections;

  const sortable = useSortableGroups(
    sectionOrder(drawn),
    // A drop settles here first and `onMove` then sets its order; a cancel only settles.
    (next, { settled }) => setOrder(settled ? null : next),
    ({ id, to, index }, next) => {
      setOrder(next);
      move.mutate(
        { id, input: { groupId: groupIdOf(to), position: index } },
        { onSettled: () => setOrder(null) },
      );
    },
  );

  const handlers = {
    ...sortable,
    onDragStart: (...args: Parameters<typeof sortable.onDragStart>) => {
      setDragging(true);
      sortable.onDragStart(...args);
    },
    onDragEnd: (...args: Parameters<typeof sortable.onDragEnd>) => {
      setDragging(false);
      sortable.onDragEnd(...args);
    },
    onDragCancel: () => {
      setDragging(false);
      sortable.onDragCancel();
    },
  };

  return { sections: drawn, handlers, error: move.error, reset: move.reset };
}
