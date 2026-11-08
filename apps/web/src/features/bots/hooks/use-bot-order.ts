import {
  type SortableGroups,
  sortableProjectId,
  useSortableGroups,
} from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useMoveBotGroup, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import {
  botSections,
  groupIdOf,
  groupOrder,
  inOrder,
  positionAmong,
  sectionOrder,
} from '../lib/bot-groups';

/** The `SortableGroup` the groups sit in; a group's bots sit in one named by its id. */
export const GROUPS = 'groups';

/**
 * The Employees sidebar's sections in the order the reader drags them into,
 * and the drag that changes it. A bot dropped somewhere new is saved there
 * (`groupId` and `position`, the API closing the others up around it), and
 * so is a group dragged above or below the others (its `position`; Ungrouped
 * stays last and does not move). Either is drawn where it was dropped while
 * the write is in flight and until the list is read again after it lands,
 * and a write that fails puts it back and says so. While a drag is held the
 * sections are the ones the drag layer last published, and Ungrouped is
 * drawn even with no bot, so a bot can always be dragged out of its group.
 * The bots in `hidden` are not drawn, so a drop is placed among every bot
 * of its group, hidden ones included, next to the drawn bot it landed by.
 * Spread `handlers` on the sidebar's `DragProvider`.
 */
export function useBotOrder(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  term: string,
  hidden: readonly string[],
) {
  const [dragging, setDragging] = useState(false);
  // The groups the drag layer last published while a drag is held, then the
  // drop's until its write settles; `null` is the server's order.
  const [order, setOrder] = useState<SortableGroups | null>(null);
  const move = useUpdateBot();
  const moveGroup = useMoveBotGroup();
  const sections = botSections(bots, groups, term, { keepUngrouped: dragging, hidden });
  const byItemId = new Map(groups.map((group) => [sortableProjectId(group.id), group.id]));
  const groupIdsOf = (value: SortableGroups) =>
    (value[GROUPS] ?? []).flatMap((itemId) => byItemId.get(itemId) ?? []);
  const drawn = order ? inOrder(sections, order, groupIdsOf(order)) : sections;

  const sortable = useSortableGroups(
    { ...sectionOrder(drawn), [GROUPS]: groupOrder(drawn).map(sortableProjectId) },
    // A drop settles here first and `onMove` then sets its order; a cancel only settles.
    (next, { settled }) => setOrder(settled ? null : next),
    ({ id, from, to, index }, next) => {
      setOrder(next);
      const onSettled = () => setOrder(null);
      const groupId = byItemId.get(id);
      if (from === GROUPS && groupId) {
        moveGroup.mutate({ id: groupId, position: index }, { onSettled });
        return;
      }
      const every = sectionOrder(botSections(bots, groups, '', { keepUngrouped: true }));
      const position = positionAmong(every[to] ?? [], next[to] ?? [], id);
      move.mutate({ id, input: { groupId: groupIdOf(to), position } }, { onSettled });
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

  return {
    sections: drawn,
    handlers,
    /** A bot's drop that failed, and a group's: each is said in its own words. */
    botError: move.error,
    groupError: moveGroup.error,
    resetBot: move.reset,
    resetGroup: moveGroup.reset,
  };
}
