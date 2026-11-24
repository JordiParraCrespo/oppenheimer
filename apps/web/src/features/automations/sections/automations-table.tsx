import {
  EmptyState,
  RoutineTable,
  RoutineTableHead,
  RunsListEmpty,
} from '@oppenheimer/design-system-web';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useProjects, useSuspenseAutomations } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { AutomationTableRow } from '../components/automation-table-row';
import { FilterClear } from '../components/filter-clear';
import { FilterRow } from '../components/filter-row';
import { SearchChoiceToken } from '../components/search-choice-token';
import { TriggerFacet } from '../components/trigger-facet';
import { useAutomationActions } from '../hooks/use-automation-actions';
import { useAutomationsFilters } from '../hooks/use-automations-filters';
import { automationColumns, automationSubline } from '../lib/automation-view';
import { filterList, STATUS_TABS, usedTriggerSources } from '../lib/list-filters';
import { runLocation } from '../lib/run-location';
import { automationTriggerText } from '../lib/trigger-text';

const ALL = '__all__';

/**
 * The overview's Automations view: one row per automation in the workspace,
 * oldest first as the API lists them. A row opens the automation's page;
 * its menu edits, runs, pauses, duplicates or deletes it in place. What an
 * action could not do stays on screen above the table.
 *
 * Delete asks first, like the automation's own page. The table owns which
 * row's confirm is open, because a row's menu unmounts when it closes.
 *
 * Above the rows, the filter row the Runs and Bot routines tabs share:
 * status pills with counts, then the Project and Trigger facets and Clear,
 * all in the URL. The endpoint answers every automation at once, so the
 * facets narrow the whole list, not a page.
 *
 * Read under Suspense: the screen's `QueryState` draws the placeholder and a
 * first failure. A refetch that fails keeps the rows and says so above them.
 */
export function AutomationsTable() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const dialogs = useConsoleDialog();
  const { data: rows, error } = useSuspenseAutomations();
  const filters = useAutomationsFilters();
  const { data: projectNames = new Map<string, string>() } = useProjects({
    select: (projects) => new Map(projects.map((project) => [project.id, project.name])),
  });
  const [deleting, setDeleting] = useState<AutomationEntity | null>(null);
  const actions = useAutomationActions({
    onOpenRun: (run) => navigate(runLocation(run)),
    onDuplicated: (id) =>
      navigate({ to: '/automations/$automationId', params: { automationId: id } }),
    onDeleted: () => setDeleting(null),
  });
  const { state } = filters;
  const { rows: shown, counts } = filterList(rows, state, (automation) => automation.projectId);
  // Only the projects some automation is in: a pick never lands on nothing.
  const projectIds = [...new Set(rows.map((automation) => automation.projectId))];
  const projectLabel = state.owner ? projectNames.get(state.owner) : undefined;
  // The list holds many automations, so its one alert says which one failed.
  const failedName = rows.find((row) => row.id === actions.failedId)?.name;

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert
        error={actions.failure}
        fallback={t('automations.page.actionFailed')}
        title={failedName ? t('automations.page.actionFailedFor', { name: failedName }) : undefined}
        onDismiss={actions.dismissFailure}
      />
      <ErrorAlert error={error} fallback={t('automations.page.loadFailed')} />
      {rows.length === 0 ? (
        <RoutineTable>
          <EmptyState className="py-14">
            <EmptyState.Header>
              <EmptyState.Art name="automations" />
              <EmptyState.Title>{t('automations.page.emptyTitle')}</EmptyState.Title>
              <EmptyState.Description>{t('automations.page.empty')}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </RoutineTable>
      ) : (
        <RoutineTable>
          <FilterRow
            tabs={STATUS_TABS}
            value={state.status}
            label={(tab) => t(`automations.filter.${tab}`)}
            count={(tab) => counts[tab]}
            onValueChange={filters.setStatus}
          >
            <SearchChoiceToken
              label={projectLabel ?? t('automations.runs.allProjects')}
              value={state.owner ?? ALL}
              dirty={state.owner !== null}
              searchPlaceholder={t('common.search.projects')}
              emptyText={(query) => t('common.search.noMatch', { query })}
              options={[
                { value: ALL, label: t('automations.runs.allProjects') },
                ...projectIds.map((id) => ({ value: id, label: projectNames.get(id) ?? id })),
              ]}
              onValueChange={(value) => filters.setProject(value === ALL ? null : value)}
            />
            <TriggerFacet
              value={state.trigger}
              sources={usedTriggerSources(rows)}
              onValueChange={filters.setTrigger}
            />
            {filters.dirty ? (
              <FilterClear onClick={filters.clear}>{t('automations.runs.clear')}</FilterClear>
            ) : null}
          </FilterRow>
          <RoutineTableHead columns={automationColumns(t)} />
          {shown.length === 0 ? (
            <RunsListEmpty>{t('automations.page.filterNoMatch')}</RunsListEmpty>
          ) : null}
          {shown.map((automation) => (
            <AutomationTableRow
              key={automation.id}
              automation={automation}
              subline={automationSubline(automation, projectNames.get(automation.projectId), t)}
              trigger={automationTriggerText(automation, locale, t)}
              onOpen={() =>
                navigate({
                  to: '/automations/$automationId',
                  params: { automationId: automation.id },
                })
              }
              onEdit={() => dialogs.open({ kind: 'automation', automationId: automation.id })}
              onRunNow={() => actions.runNow(automation.id)}
              onTogglePause={() => actions.setPaused(automation.id, !automation.isPaused)}
              onDuplicate={() => actions.duplicate(automation.id)}
              onDelete={() => setDeleting(automation)}
            />
          ))}
        </RoutineTable>
      )}
      {deleting ? (
        <ConfirmDialog
          title={t('automations.deleteDialog.title', { name: deleting.name })}
          description={t('automations.deleteDialog.description')}
          confirmLabel={t('automations.deleteDialog.confirm')}
          pendingLabel={t('automations.deleteDialog.deleting')}
          pending={actions.removing}
          error={actions.removeFailure}
          errorFallback={t('automations.deleteDialog.failed')}
          onClose={() => {
            actions.resetRemove();
            setDeleting(null);
          }}
          onConfirm={() => actions.remove(deleting.id, deleting.name)}
        />
      ) : null}
    </div>
  );
}
