import {
  Alert,
  AlertDescription,
  PillTab,
  PillTabs,
  RunRow,
  RunsList,
  RunsListEmpty,
  RunsListFilters,
  RunsListFoot,
  RunsListHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  useAutomationRuns,
  useAutomations,
  useProjects,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useLocale } from '@oppenheimer/frontend-web';
import { RUN_WINDOWS } from '@oppenheimer/shared/automations';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ChoiceToken } from '../components/choice-token';
import {
  RUN_STATUS_TABS,
  RUNS_PAGE_SIZE,
  type RunStatusTab,
  useRunsFilters,
} from '../hooks/use-runs-filters';
import { runState, runTitle } from '../lib/automation-view';
import { clock, monthDay } from '../lib/time';
import { automationTriggerText } from '../lib/trigger-text';

const ALL = '__all__';

/**
 * The runs (`product/versions/mvp/13-automations.md`): the Runs tab across
 * the workspace, or one automation's on its page. Status pills with counts,
 * the facets on the right, a page of ten and the pager. A run opens the
 * session it started in the run view, with the automations list kept beside
 * it. A list that could not load says so, rather than reading as empty.
 */
export function RunsTable({ automationId }: { automationId?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const filters = useRunsFilters({ automationId });
  const runs = useAutomationRuns(filters.filter);
  // The facets are the workspace-wide list's only; an automation's page has none.
  const { data: automations } = useAutomations({ enabled: !automationId });
  const { data: projects } = useProjects({
    enabled: !automationId,
    select: (rows) => rows.filter((project) => !project.isUnassigned),
  });

  const page = runs.data;
  const counts = page?.counts;
  const first = page?.total ? (page.page - 1) * RUNS_PAGE_SIZE + 1 : 0;
  const last = page ? Math.min(page.total, page.page * RUNS_PAGE_SIZE) : 0;
  const { state } = filters;

  const automationName = automations?.find((row) => row.id === state.automation)?.name;
  const projectName = projects?.find((row) => row.id === state.project)?.name;

  return (
    <RunsList>
      <RunsListFilters>
        <PillTabs
          size="sm"
          value={state.status}
          onValueChange={(value) => filters.setStatus(value as RunStatusTab)}
        >
          {RUN_STATUS_TABS.map((tab) => (
            <PillTab key={tab} value={tab} count={counts ? counts[tab] : undefined}>
              {t(`automations.runs.${tab}`)}
            </PillTab>
          ))}
        </PillTabs>
        <span className="flex-1" />
        {automationId ? null : (
          <>
            <ChoiceToken
              label={automationName ?? t('automations.runs.allAutomations')}
              value={state.automation ?? ALL}
              dirty={state.automation !== null}
              options={[
                { value: ALL, label: t('automations.runs.allAutomations') },
                ...(automations ?? []).map((automation) => ({
                  value: automation.id,
                  label: automation.name,
                  description: automationTriggerText(automation, locale, t),
                })),
              ]}
              onValueChange={(value) => filters.setAutomation(value === ALL ? null : value)}
            />
            <ChoiceToken
              label={projectName ?? t('automations.runs.allProjects')}
              value={state.project ?? ALL}
              dirty={state.project !== null}
              options={[
                { value: ALL, label: t('automations.runs.allProjects') },
                ...(projects ?? []).map((project) => ({ value: project.id, label: project.name })),
              ]}
              onValueChange={(value) => filters.setProject(value === ALL ? null : value)}
            />
          </>
        )}
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
          <button
            type="button"
            onClick={filters.clear}
            className="ml-1 text-[13px] text-fg-muted transition-colors duration-fast hover:text-fg"
          >
            {t('automations.runs.clear')}
          </button>
        ) : null}
      </RunsListFilters>

      <RunsListHead
        columns={[
          t('automations.runs.run'),
          t('automations.runs.automation'),
          t('automations.runs.time'),
        ]}
      />

      {runs.isError && !page ? (
        <Alert variant="destructive" className="mx-1.5 mb-1.5">
          <AlertDescription>
            {resolveError(runs.error, t('automations.runs.loadFailed')).message}
          </AlertDescription>
        </Alert>
      ) : runs.isPending ? (
        <div className="flex flex-col gap-1 px-1.5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : page?.items.length ? (
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
      ) : (
        <RunsListEmpty>
          {counts?.all || filters.dirty
            ? t('automations.runs.noMatch')
            : t('automations.page.runsEmpty')}
        </RunsListEmpty>
      )}

      {page?.total ? (
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
