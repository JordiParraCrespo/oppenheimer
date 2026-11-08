import { BotList } from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { SidebarPinnedGroup } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { PINNED_BOTS } from '@/features/bots/lib/bot-pins';
import { BotSidebarRow } from './bot-sidebar-row';

/**
 * The bots the reader pinned, above the groups of the Employees sidebar, in
 * the kit's `SidebarPinnedGroup`. A pinned bot is drawn here instead of in
 * its group, in pin order, with the menu it has there. A bot dropped on it is
 * pinned, and its rows drag up or down it or out into a group
 * (`useBotOrder`), unless a search narrows the list. With nothing pinned it
 * is drawn only while a bot is carried, as the place to drop it.
 */
export function PinnedBots({
  bots,
  groups,
  searching,
  onHide,
}: {
  bots: readonly BotEntity[];
  /** Every group, for the rows' Move pane. */
  groups: readonly BotGroupEntity[];
  searching: boolean;
  /** Hides a bot from the sidebar, from its row's menu. */
  onHide: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <SidebarPinnedGroup
      id={PINNED_BOTS}
      label={t('bots.sidebar.pinned')}
      items={bots.map((bot) => bot.id)}
      accepts={searching ? [] : ['bot']}
      emptyHint={t('bots.sidebar.dropToPin')}
    >
      <BotList>
        {bots.map((bot) => (
          <BotSidebarRow
            key={bot.id}
            bot={bot}
            groups={groups}
            dragDisabled={searching}
            onHide={onHide}
          />
        ))}
      </BotList>
    </SidebarPinnedGroup>
  );
}
