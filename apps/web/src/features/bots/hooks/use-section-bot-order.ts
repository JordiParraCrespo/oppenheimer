import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBotsSnapshot, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { placementInSection } from '../lib/section-order';

/**
 * A section's Bots heading in the order the reader drags it into, and the
 * drag that changes it. The order is the one Employees draws, not the
 * section's own (`28-bots-in-sections.md`), so a drop is saved as the bot's
 * place there (`placementInSection`) and every page that lists it follows.
 * The bot is drawn where it was dropped while the write is in flight and
 * until the list is read again after it lands; a write that fails puts it
 * back and says so. Spread `handlers` on the heading's `DragProvider`, and
 * give its `SortableGroup` the `group` key.
 */
export function useSectionBotOrder(section: BotSection, bots: readonly BotEntity[]) {
  // The order the drag layer last published while a drag is held, then the
  // drop's until its write settles; `null` is the server's.
  const [order, setOrder] = useState<SortableGroups | null>(null);
  const allBots = useBotsSnapshot();
  const move = useUpdateBot();
  const ids = order?.[section];
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const drawn = ids
    ? [
        ...ids.flatMap((id) => byId.get(id) ?? []),
        // As in `inOrder`: the order was drawn from these same bots, so it names
        // every one; a bot placed here while a write is pending goes after the
        // ones it places, and an id that is no longer listed is skipped.
        ...bots.filter((bot) => !ids.includes(bot.id)),
      ]
    : bots;

  const handlers = useSortableGroups(
    { [section]: drawn.map((bot) => bot.id) },
    (next, { settled }) => setOrder(settled ? null : next),
    ({ id }, next) => {
      const placement = placementInSection(allBots() ?? bots, next[section] ?? [], id);
      if (!placement) return;
      setOrder(next);
      move.mutate({ id, input: placement }, { onSettled: () => setOrder(null) });
    },
  );

  return { bots: drawn, group: section, handlers, error: move.error, reset: move.reset };
}
