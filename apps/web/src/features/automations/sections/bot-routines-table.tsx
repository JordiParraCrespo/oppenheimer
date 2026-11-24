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
import { ChoiceToken } from '../components/choice-token';
import { FilterClear } from '../components/filter-clear';
import { FilterRow } from '../components/filter-row';
import { SearchChoiceToken } from '../components/search-choice-token';
import { useRoutinesFilters } from '../hooks/use-routines-filters';
import { botRoutineColumns } from '../lib/automation-view';
import {
  filterRoutines,
  ROUTINE_STATUS_TABS,
  ROUTINE_TRIGGER_SOURCES,
  type RoutineTriggerSource,
} from '../lib/routines-search';

const ALL = '__all__';

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
  const filters = useRoutinesFilters();
  const { data: routines, error } = useSuspenseAllBotRoutines();
  const { data: botNames = new Map<string, string>() } = useBots({
    select: (bots) => new Map(bots.map((bot) => [bot.id, bot.name])),
  });
  const { state } = filters;
  const { rows, counts } = filterRoutines(routines, state);

  // Only the bots and triggers some routine has: a pick never lands on nothing.
  const botIds = [...new Set(routines.map((routine) => routine.botId))];
  const sources = ROUTINE_TRIGGER_SOURCES.filter((source) =>
    routines.some((routine) => routine.triggers.some((trigger) => trigger.source === source)),
  );
  const botLabel = state.bot ? botNames.get(state.bot) : undefined;

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
            <FilterRow
              tabs={ROUTINE_STATUS_TABS}
              value={state.status}
              label={(tab) => t(`automations.routines.filter.${tab}`)}
              count={(tab) => counts[tab]}
              onValueChange={filters.setStatus}
            >
              <SearchChoiceToken
                label={botLabel ?? t('automations.routines.filter.allBots')}
                value={state.bot ?? ALL}
                dirty={state.bot !== null}
                searchPlaceholder={t('automations.routines.filter.searchBots')}
                emptyText={(query) => t('common.search.noMatch', { query })}
                options={[
                  { value: ALL, label: t('automations.routines.filter.allBots') },
                  ...botIds.map((id) => ({ value: id, label: botNames.get(id) ?? id })),
                ]}
                onValueChange={(value) => filters.setBot(value === ALL ? null : value)}
              />
              <ChoiceToken
                label={t(`automations.routines.filter.trigger.${state.trigger ?? 'any'}`)}
                value={state.trigger ?? ALL}
                dirty={state.trigger !== null}
                options={[
                  { value: ALL, label: t('automations.routines.filter.trigger.any') },
                  ...sources.map((source) => ({
                    value: source,
                    label: t(`automations.routines.filter.trigger.${source}`),
                  })),
                ]}
                onValueChange={(value) =>
                  filters.setTrigger(value === ALL ? null : (value as RoutineTriggerSource))
                }
              />
              {filters.dirty ? (
                <FilterClear onClick={filters.clear}>{t('automations.runs.clear')}</FilterClear>
              ) : null}
            </FilterRow>
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
