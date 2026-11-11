import { RoutineTable, RoutineTableEmpty, RoutineTableHead } from '@oppenheimer/design-system-web';
import { Bot } from '@oppenheimer/design-system-web/icons';
import { useBots, useSuspenseAllBotRoutines } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, triggerListText, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BotRoutineTableRow } from '../components/bot-routine-table-row';

/**
 * The workspace's bot routines, the overview's Bot routines tab
 * (`26-bot-routines.md` §7): a bot's own work, kept apart from the sessions
 * the automations start, with the bot that runs each. A row opens that bot's
 * Routines tab. With none, the empty row says where they are made: a bot's
 * chat, not here.
 *
 * Read under Suspense: the screen's `QueryState` draws the placeholder and a
 * first failure. A refetch that fails keeps the rows and says so above them.
 */
export function BotRoutinesTable() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { data: routines, error } = useSuspenseAllBotRoutines();
  const { data: botNames } = useBots({
    select: (bots) => new Map(bots.map((bot) => [bot.id, bot.name])),
  });
  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert error={error} fallback={t('automations.routines.loadFailed')} />
      {routines.length === 0 ? (
        <RoutineTable>
          <RoutineTableEmpty>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-hover-surface text-fg-muted [&_svg]:size-4">
              <Bot />
            </span>
            <span>{t('automations.routines.empty')}</span>
          </RoutineTableEmpty>
        </RoutineTable>
      ) : (
        <RoutineTable>
          <RoutineTableHead
            columns={[
              t('automations.routines.routine'),
              t('automations.table.trigger'),
              t('automations.table.next'),
              t('automations.table.status'),
            ]}
          />
          {routines.map((routine) => (
            <BotRoutineTableRow
              key={routine.id}
              routine={routine}
              botName={botNames?.get(routine.botId)}
              trigger={triggerListText(routine.triggers, locale, t)}
              onOpen={() =>
                navigate({
                  to: '/bots/$botId/settings/routines',
                  params: { botId: routine.botId },
                })
              }
            />
          ))}
        </RoutineTable>
      )}
    </div>
  );
}
