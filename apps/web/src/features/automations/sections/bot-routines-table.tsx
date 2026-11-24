import {
  EmptyState,
  RoutineTable,
  RoutineTableHead,
  RunsListEmpty,
} from '@oppenheimer/design-system-web';
import { useBots, useSuspenseAllBotRoutines } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, triggerListText, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BotRoutineTableRow } from '../components/bot-routine-table-row';
import { ListFilterBar } from '../components/list-filter-bar';
import { useListFilters } from '../hooks/use-list-filters';
import { botRoutineColumns } from '../lib/automation-view';
import { filterList, usedTriggerSources } from '../lib/list-filters';

/**
 * The workspace's bot routines, the overview's Bot routines tab: a bot's
 * own work, kept apart from the sessions the automations start, with the
 * bot that runs each. A row opens that bot's Routines tab. With none, the
 * empty state says where they are made: a bot's chat, not here.
 *
 * Above the rows, the Runs tab's filter row: status pills with counts, then
 * the Bot and Trigger facets and Clear, all in the URL. The endpoint answers
 * every routine at once, so the facets narrow the whole list, not a page.
 *
 * Read under Suspense: the screen's `QueryState` draws the placeholder and a
 * first failure. A refetch that fails keeps the rows and says so above them.
 */
export function BotRoutinesTable() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const filters = useListFilters('routines');
  const { data: routines, error } = useSuspenseAllBotRoutines();
  const { data: botNames = new Map<string, string>() } = useBots({
    select: (bots) => new Map(bots.map((bot) => [bot.id, bot.name])),
  });
  const { rows, counts } = filterList(routines, filters.state, (routine) => routine.botId);

  // Only the bots and triggers some routine has: a pick never lands on nothing.
  const botIds = [...new Set(routines.map((routine) => routine.botId))];

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert error={error} fallback={t('automations.routines.loadFailed')} />
      <RoutineTable>
        {routines.length === 0 ? (
          <EmptyState className="py-14">
            <EmptyState.Header>
              <EmptyState.Art name="automations" />
              <EmptyState.Title>{t('automations.routines.emptyTitle')}</EmptyState.Title>
              <EmptyState.Description>{t('automations.routines.empty')}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <>
            <ListFilterBar
              filters={filters}
              counts={counts}
              owner={{
                allLabel: t('automations.routines.filter.allBots'),
                searchPlaceholder: t('automations.routines.filter.searchBots'),
                options: botIds.map((id) => ({ value: id, label: botNames.get(id) ?? '…' })),
              }}
              sources={usedTriggerSources(routines)}
            />
            <RoutineTableHead columns={botRoutineColumns(t)} />
            {rows.length === 0 ? (
              <RunsListEmpty>{t('automations.routines.filter.noMatch')}</RunsListEmpty>
            ) : (
              rows.map((routine) => (
                <BotRoutineTableRow
                  key={routine.id}
                  routine={routine}
                  botName={botNames.get(routine.botId)}
                  trigger={triggerListText(routine.triggers, locale, t)}
                  onOpen={() =>
                    navigate({
                      to: '/bots/$botId/settings/routines',
                      params: { botId: routine.botId },
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </RoutineTable>
    </div>
  );
}
