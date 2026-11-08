import {
  BotList,
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
} from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PINNED_BOTS } from '@/features/bots/lib/bot-pins';
import { BotSidebarRow } from './bot-sidebar-row';

/**
 * The bots the reader pinned, above the groups of the Employees sidebar,
 * under an eyebrow head like the groups' (the sessions sidebar's Pinned, for
 * bots). A pinned bot is drawn here instead of in its group, in pin order,
 * with the menu it has there. Its `SortableGroup` takes bots: one dropped on
 * it is pinned, and its rows drag up or down it or out into a group
 * (`useBotOrder`), unless a search narrows the list. With nothing pinned it
 * is drawn only while a bot is carried, as the place to drop it.
 */
export function PinnedBots({
  bots,
  groups,
  searching,
}: {
  bots: readonly BotEntity[];
  /** Every group, for the rows' Move pane. */
  groups: readonly BotGroupEntity[];
  searching: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <SidebarProjectGroup>
      <SortableGroup
        id={PINNED_BOTS}
        // A folded group's rows are not drawn, so it holds none; a drop on it still lands.
        items={open ? bots.map((bot) => bot.id) : []}
        accepts={searching ? [] : ['bot']}
        data={{ label: t('bots.sidebar.pinned') }}
        className="flex flex-col"
      >
        <SidebarProjectHeader
          tone="eyebrow"
          name={t('bots.sidebar.pinned')}
          // The drop hint below says it holds none; a 0 beside it adds nothing.
          count={bots.length || undefined}
          open={open}
          onOpenChange={setOpen}
        />
        {!open ? null : bots.length === 0 ? (
          <SidebarEmptyRow>{t('bots.sidebar.dropToPin')}</SidebarEmptyRow>
        ) : (
          <BotList>
            {bots.map((bot) => (
              <BotSidebarRow key={bot.id} bot={bot} groups={groups} dragDisabled={searching} />
            ))}
          </BotList>
        )}
      </SortableGroup>
    </SidebarProjectGroup>
  );
}
