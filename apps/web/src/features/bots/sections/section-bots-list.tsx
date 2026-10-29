import {
  BotItem,
  BotList,
  DragProvider,
  SidebarEmptyRow,
  SortableGroup,
  useNow,
} from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseSectionBots } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert, useDragLabels } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { useSectionBotOrder } from '@/features/bots/hooks/use-section-bot-order';
import { SectionBotRow } from './section-bot-row';

/**
 * The bots placed in `section`, in the Employees order, with one minute
 * clock for their ages. Before the first, a line says so and offers the
 * heading's menu (`onAdd`), where a bot is made or placed here. A row's Hide
 * is the heading's write (`onHide`), like the menu's checks. A refetch that
 * fails keeps the rows and says so above them.
 *
 * The rows drag into another place (`useSectionBotOrder`), by pointer or by
 * keyboard (Space picks a row up, Enter still opens it), on the heading's
 * own `DragProvider`. The order is the one Employees draws, so a drop here
 * moves the bot there and under every other heading that lists it.
 */
export function SectionBotsList({
  section,
  onAdd,
  onHide,
}: {
  section: BotSection;
  onAdd: () => void;
  onHide: (bot: BotEntity) => void;
}) {
  const { t } = useTranslation();
  const { data: listed, error } = useSuspenseSectionBots(section);
  const { bots, group, handlers, error: moveError, reset } = useSectionBotOrder(section, listed);
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const dragLabels = useDragLabels();

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} className="mx-3 mb-2" />
      <ErrorAlert
        error={moveError}
        fallback={t('bots.sidebar.moveFailed')}
        onDismiss={reset}
        className="mx-3 mb-2"
      />
      {bots.length === 0 ? (
        <SidebarEmptyRow className="ml-3.5">
          {t('bots.section.empty')}{' '}
          <button type="button" onClick={onAdd}>
            {t('bots.section.add')}
          </button>
        </SidebarEmptyRow>
      ) : (
        <DragProvider
          {...handlers}
          labels={dragLabels}
          overlay={(active) => {
            const bot = bots.find((candidate) => candidate.id === active.id);
            // The lifted row, on the sidebar's ground at its width.
            return bot ? (
              <div className="w-60 rounded-md bg-sidebar">
                <BotItem name={bot.name} initials={bot.initials} color={bot.avatarColor} active />
              </div>
            ) : null;
          }}
        >
          <SortableGroup
            id={group}
            items={bots.map((bot) => bot.id)}
            accepts={['bot']}
            data={{ label: t('bots.section.heading') }}
          >
            <BotList className="mx-1.5">
              {bots.map((bot) => (
                <SectionBotRow
                  key={bot.id}
                  bot={bot}
                  section={section}
                  now={now}
                  onHide={() => onHide(bot)}
                />
              ))}
            </BotList>
          </SortableGroup>
        </DragProvider>
      )}
    </>
  );
}
