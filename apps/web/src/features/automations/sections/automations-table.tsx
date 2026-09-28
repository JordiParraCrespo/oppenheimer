import {
  RoutineTable,
  RoutineTableEmpty,
  RoutineTableHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useAutomations, useProjects } from '@oppenheimer/frontend-consumer/react';
import {
  ConfirmDialog,
  ErrorAlert,
  QueryState,
  useConsoleDialog,
  useLocale,
} from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutomationTableRow } from '../components/automation-table-row';
import { useAutomationActions } from '../hooks/use-automation-actions';
import { automationSubline } from '../lib/automation-view';
import { runLocation } from '../lib/run-location';
import { automationTriggerText } from '../lib/trigger-text';

/**
 * The overview's Automations view (`product/versions/mvp/13-automations.md`):
 * one row per automation in the workspace, oldest first as the API lists
 * them. A row opens the automation's page; its menu edits, runs, pauses,
 * duplicates or deletes it in place. What an action could not do stays on
 * screen above the table.
 *
 * Delete asks first, like the automation's own page. The table owns which
 * row's confirm is open, because a row's menu unmounts when it closes.
 */
export function AutomationsTable() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const dialogs = useConsoleDialog();
  const automations = useAutomations();
  const { data: projectNames } = useProjects({
    select: (projects) => new Map(projects.map((project) => [project.id, project.name])),
  });
  const [deleting, setDeleting] = useState<AutomationEntity | null>(null);
  const actions = useAutomationActions({
    onOpenRun: (run) => navigate(runLocation(run)),
    onDuplicated: (id) =>
      navigate({ to: '/automations/$automationId', params: { automationId: id } }),
    onDeleted: () => setDeleting(null),
  });
  // The list holds many automations, so its one alert says which one failed.
  const failedName = automations.data?.find((row) => row.id === actions.failedId)?.name;

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert
        error={actions.failure}
        fallback={t('automations.page.actionFailed')}
        title={failedName ? t('automations.page.actionFailedFor', { name: failedName }) : undefined}
        onDismiss={actions.dismissFailure}
      />
      <RoutineTable>
        <QueryState
          query={automations}
          pending={
            <div className="flex flex-col gap-1.5 p-1.5">
              <Skeleton className="h-13.5 w-full" />
              <Skeleton className="h-13.5 w-full" />
            </div>
          }
          errorFallback={t('automations.page.loadFailed')}
          errorClassName="m-1.5"
          empty={{
            when: (rows) => rows.length === 0,
            show: (
              <RoutineTableEmpty>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-hover-surface text-fg-muted [&_svg]:size-4">
                  <Zap />
                </span>
                <span>{t('automations.page.empty')}</span>
              </RoutineTableEmpty>
            ),
          }}
        >
          {(rows) => (
            <>
              <RoutineTableHead
                columns={[
                  t('automations.table.automation'),
                  t('automations.table.trigger'),
                  t('automations.table.next'),
                  t('automations.table.status'),
                ]}
              />
              {rows.map((automation) => (
                <AutomationTableRow
                  key={automation.id}
                  automation={automation}
                  subline={automationSubline(automation, projectNames?.get(automation.projectId))}
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
            </>
          )}
        </QueryState>
      </RoutineTable>
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
