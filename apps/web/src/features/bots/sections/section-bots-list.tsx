import { BotList, SidebarEmptyRow, useNow } from '@oppenheimer/design-system-web';
import { useSuspenseSectionBots } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { SectionBotRow } from './section-bot-row';

/**
 * The bots placed in `section`, in the Employees order, with one minute
 * clock for their ages. Before the first, a line says how one gets here. A
 * refetch that fails keeps the rows and says so above them.
 */
export function SectionBotsList({ section }: { section: BotSection }) {
  const { t } = useTranslation();
  const { data: bots, error } = useSuspenseSectionBots(section);
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} className="mx-3 mb-2" />
      {bots.length === 0 ? (
        <SidebarEmptyRow className="ml-3.5">{t('bots.section.empty')}</SidebarEmptyRow>
      ) : (
        <BotList className="mx-1.5">
          {bots.map((bot) => (
            <SectionBotRow key={bot.id} bot={bot} section={section} now={now} />
          ))}
        </BotList>
      )}
    </>
  );
}
