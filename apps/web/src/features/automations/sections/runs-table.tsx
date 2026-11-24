import {
  RunRow,
  RunsList,
  RunsListEmpty,
  RunsListFoot,
  RunsListHead,
} from '@oppenheimer/design-system-web';
import { useSuspenseAutomationRuns } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { RUN_WINDOWS } from '@oppenheimer/shared/automations';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceToken } from '../components/choice-token';
import { FilterClear } from '../components/filter-clear';
import { FilterRow } from '../components/filter-row';
import { RUNS_PAGE_SIZE, useRunsFilters } from '../hooks/use-runs-filters';
import { runState, runTitle } from '../lib/automation-view';
import { RUN_STATUS_TABS } from '../lib/runs-search';
import { clock, monthDay } from '../lib/time';
import { RunsFacets } from './runs-facets';

/**
 * The runs: the Runs tab across the workspace, or one automation's on its
 * page. Status pills with counts, the facets on the right, a page of ten
 * and the pager. A run opens the session it started in the run view, with
 * the automations list kept beside it.
 *
 * Read under Suspense, in the `QueryState` of the screen or page that shows
 * it. The filter is read deferred: a new filter renders the next page in the
 * background and the page on screen stays until it answers, rather than
 * dropping back to the placeholder. A refetch that fails keeps the page and
 * says so above it.
 */
export function RunsTable({ automationId }: { automationId?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const filters = useRunsFilters({ automationId });
  const settled = useDeferredValue(filters.filter);
  const { data: page, error } = useSuspenseAutomationRuns(settled);
  const counts = page.counts;
  const first = page.total ? (page.page - 1) * RUNS_PAGE_SIZE + 1 : 0;
  const last = Math.min(page.total, page.page * RUNS_PAGE_SIZE);
  const { state } = filters;

  return (
    <RunsList>
      <FilterRow
        tabs={RUN_STATUS_TABS}
        value={state.status}
        label={(tab) => t(`automations.runs.${tab}`)}
        count={(tab) => counts[tab]}
        onValueChange={filters.setStatus}
      >
        {automationId ? null : <RunsFacets />}
        <ChoiceToken
          label={t(`automations.runs.window.${state.window}`)}
          value={state.window}
          dirty={state.window !== '30d'}
          options={RUN_WINDOWS.map((window) => ({
            value: window,
            label: t(`automations.runs.window.${window}`),
          }))}
          onValueChange={(value) => filters.setWindow(value as (typeof RUN_WINDOWS)[number])}
        />
        {filters.dirty ? (
          <FilterClear onClick={filters.clear}>{t('automations.runs.clear')}</FilterClear>
        ) : null}
      </FilterRow>

      <RunsListHead
        columns={[
          t('automations.runs.run'),
          t('automations.runs.automation'),
          t('automations.runs.time'),
        ]}
      />

      <ErrorAlert
        error={error}
        fallback={t('automations.runs.loadFailed')}
        className="mx-1.5 mb-1.5"
      />
      {page.items.length === 0 ? (
        <RunsListEmpty>
          {counts.all || filters.dirty
            ? t('automations.runs.noMatch')
            : t('automations.page.runsEmpty')}
        </RunsListEmpty>
      ) : (
        page.items.map((run) => (
          <RunRow
            key={run.id}
            state={runState(run.status)}
            title={runTitle(run, t)}
            aria-label={`${runTitle(run, t)} · ${t(`automations.runStatus.${run.status}`)}`}
            routine={run.automationDeleted ? t('automations.runs.deleted') : run.automationName}
            date={monthDay(run.createdAt, locale)}
            time={clock(run.createdAt)}
            disabled={!run.sessionId}
            onClick={() => {
              if (run.sessionId) {
                navigate({
                  to: '/automations/$automationId/sessions/$sessionId',
                  params: { automationId: run.automationId, sessionId: run.sessionId },
                });
              }
            }}
          />
        ))
      )}

      {page.total ? (
        <RunsListFoot
          range={t('automations.runs.range', { from: first, to: last, total: page.total })}
          previousLabel={t('automations.runs.previous')}
          nextLabel={t('automations.runs.next')}
          onPrevious={page.page > 1 ? () => filters.setPage(page.page - 1) : undefined}
          onNext={last < page.total ? () => filters.setPage(page.page + 1) : undefined}
        />
      ) : null}
    </RunsList>
  );
}
