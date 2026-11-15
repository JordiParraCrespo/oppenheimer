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
  groupPosition,
  inGroupOrder,
  inOrder,
  sectionOrder,
  UNGROUPED,
  ungroupedBeforeIn,
} from '../lib/bot-groups';
import { botDrop, PINNED_BOTS, splitPinnedBots } from '../lib/bot-pins';
import type { BotPins } from './use-bot-pins';
import type { UngroupedPlace } from './use-ungrouped-place';

/** The `SortableGroup` the groups sit in; a group's bots sit in one named by its id. */
export const GROUPS = 'groups';

/**
 * The Employees sidebar's sections in the order the reader drags them into,
 * and the drag that changes it. A bot dropped somewhere new is saved there
 * (`groupId` and `position`, the API closing the others up around it), and
 * so is a group dragged above or below the others (its `position`). Ungrouped
 * drags among the groups too, and its place (`ungrouped`, the group it is
 * above) is kept on this device; a group dropped next to it moves that place
 * with it. Either is drawn where it was dropped while
 * the write is in flight and until the list is read again after it lands,
 * and a write that fails puts it back and says so. While a drag is held the
 * sections are the ones the drag layer last published, and Ungrouped is
 * drawn even with no bot, so a bot can always be dragged out of its group.
 * Spread `handlers` on the sidebar's `DragProvider`.
 *
 * Pinned is one more group (`PINNED_BOTS`), drawn above the others: a bot
 * dropped on it is pinned where it lands, a pinned one dragged up or down it
 * is re-pinned in that order, both on this device only, and one dragged out
 * into a group is saved there and unpinned once the save lands (a save that
 * fails leaves it pinned). `pinned` are the pinned bots the
 * search keeps, in pin order; `carrying` is whether a bot is being dragged,
 * for Pinned to show where a pin can go before there is one.
 *
 * The bots in `hidden` are drawn nowhere, pinned or not, unless a search
 * names them. A drop is placed among every bot of its group, the ones not
 * drawn included (`botDrop`), so a hidden bot keeps its place.
 */
export function useBotOrder(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  term: string,
  pins: Pick<BotPins, 'pins' | 'setPinned' | 'placePins'>,
  hidden: readonly string[],
  ungrouped: UngroupedPlace,
) {
  const [dragging, setDragging] = useState(false);
  // The groups the drag layer last published while a drag is held, then the
  // drop's until its write settles; `null` is the server's order.
  const [order, setOrder] = useState<SortableGroups | null>(null);
  const move = useUpdateBot();
  const moveGroup = useMoveBotGroup();
  const split = splitPinnedBots(bots, pins.pins, term);
  const shownPins = term ? split.pinned : split.pinned.filter((bot) => !hidden.includes(bot.id));
  const sections = botSections(split.rest, groups, term, {
    keepUngrouped: dragging,
    hidden,
    ungroupedBefore: ungrouped.before,
  });
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const byItemId = new Map(
    [...groups.map((group) => group.id), UNGROUPED].map((key) => [sortableProjectId(key), key]),
  );
  const groupIdsOf = (value: SortableGroups) =>
    (value[GROUPS] ?? []).flatMap((itemId) => byItemId.get(itemId) ?? []);
  const pinnedIds = order?.[PINNED_BOTS];
  const pinned = pinnedIds ? pinnedIds.flatMap((id) => byId.get(id) ?? []) : shownPins;
  const drawn = order
    ? inGroupOrder(inOrder(sections, order, split.pinned), groupIdsOf(order))
    : sections;

  const onSettled = () => setOrder(null);
  /** A group, or Ungrouped, dropped among the others. */
  const dropGroup = (itemId: string, next: SortableGroups) => {
    const id = byItemId.get(itemId);
    if (!id) return;
    const keys = groupIdsOf(next);
    const before = ungroupedBeforeIn(keys);
    if (id === UNGROUPED) {
      if (before !== null) ungrouped.setBefore(before);
      // A write still in flight drew its drop from the held order; keep holding it.
      if (moveGroup.isPending || move.isPending) setOrder(next);
      return;
    }
    // The held order draws Ungrouped beside the group until the write lands; a failure leaves its place.
    setOrder(next);
    moveGroup.mutate(
      { id, position: groupPosition(keys, id) },
      {
        onSuccess: () => {
          if (before !== null) ungrouped.setBefore(before);
        },
        onSettled,
      },
    );
  };
  /** A bot dropped on Pinned or in a group. */
  const dropBot = (moved: { id: string; from: string; to: string }, next: SortableGroups) => {
    const drop = botDrop(moved, next, bots, groupIdOf);
    if (drop.kind === 'pins') {
      pins.placePins(drop.pins);
      return;
    }
    // The held order draws it out of Pinned until the move lands; a move that fails keeps the pin.
    setOrder(next);
    move.mutate(
      { id: moved.id, input: { groupId: drop.groupId, position: drop.position } },
      {
        onSuccess: () => {
          if (drop.unpin) pins.setPinned(moved.id, false);
        },
        onSettled,
      },
    );
  };

  const sortable = useSortableGroups(
    {
      [PINNED_BOTS]: pinned.map((bot) => bot.id),
      ...sectionOrder(drawn),
      [GROUPS]: groupOrder(drawn).map(sortableProjectId),
    },
    // A drop settles here first and `onMove` then sets its order; a cancel only settles.
    (next, { settled }) => setOrder(settled ? null : next),
    (moved, next) => {
      if (moved.from === GROUPS) dropGroup(moved.id, next);
      else dropBot(moved, next);
    },
  );

  const handlers = {
    ...sortable,
    onDragStart: (...args: Parameters<typeof sortable.onDragStart>) => {
      // Only a bot needs Pinned and Ungrouped drawn as somewhere to drop it.
      setDragging(args[0].data.type === 'bot');
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
    pinned,
    sections: drawn,
    carrying: dragging,
    handlers,
    /** A bot's drop that failed, and a group's: each is said in its own words. */
    botError: move.error,
    groupError: moveGroup.error,
    resetBot: move.reset,
    resetGroup: moveGroup.reset,
  };
}
