import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { botSections, groupIdOf, inOrder, sectionOrder } from '../lib/bot-groups';
import { PINNED_BOTS, splitPinnedBots } from '../lib/bot-pins';
import type { BotPins } from './use-bot-pins';

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
 *
 * Pinned is one more group (`PINNED_BOTS`), drawn above the others: a bot
 * dropped on it is pinned where it lands, a pinned one dragged up or down it
 * is re-pinned in that order, both on this device only, and one dragged out
 * into a group is unpinned and saved there. `pinned` are the pinned bots the
 * search keeps, in pin order; `carrying` is whether a bot is being dragged,
 * for Pinned to show where a pin can go before there is one.
 */
export function useBotOrder(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  term: string,
  pins: Pick<BotPins, 'pins' | 'setPinned' | 'placePins'>,
) {
  const [dragging, setDragging] = useState(false);
  // The groups the drag layer last published while a drag is held, then the
  // drop's until its write settles; `null` is the server's order.
  const [order, setOrder] = useState<SortableGroups | null>(null);
  const move = useUpdateBot();
  const split = splitPinnedBots(bots, pins.pins, term);
  const sections = botSections(split.rest, groups, term, { keepUngrouped: dragging });
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const pinnedIds = order?.[PINNED_BOTS];
  const pinned = pinnedIds ? pinnedIds.flatMap((id) => byId.get(id) ?? []) : split.pinned;
  const drawn = order ? inOrder(withHeld(sections, split.pinned, pinned), order) : sections;

  const sortable = useSortableGroups(
    { [PINNED_BOTS]: pinned.map((bot) => bot.id), ...sectionOrder(drawn) },
    // A drop settles here first and `onMove` then sets its order; a cancel only settles.
    (next, { settled }) => setOrder(settled ? null : next),
    ({ id, from, to, index }, next) => {
      if (to === PINNED_BOTS) {
        pins.placePins(next[PINNED_BOTS] ?? []);
        return;
      }
      if (from === PINNED_BOTS) pins.setPinned(id, false);
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

  return {
    pinned,
    sections: drawn,
    carrying: dragging,
    handlers,
    error: move.error,
    reset: move.reset,
  };
}

/**
 * The sections with every bot the held order took out of Pinned added to
 * the first, so `inOrder` finds it and draws it where the order puts it
 * (the order names every bot it holds, so it is never drawn there).
 */
function withHeld(
  sections: ReturnType<typeof botSections>,
  wasPinned: readonly BotEntity[],
  stillPinned: readonly BotEntity[],
) {
  const kept = new Set(stillPinned.map((bot) => bot.id));
  const freed = wasPinned.filter((bot) => !kept.has(bot.id));
  const [first, ...rest] = sections;
  if (!first || freed.length === 0) return sections;
  return [{ ...first, bots: [...first.bots, ...freed] }, ...rest];
}
