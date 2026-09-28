import {
  RoutineTable,
  RoutineTableEmpty,
  RoutineTableHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { useAutomations, useProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useConsoleDialog, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AutomationTableRow } from '../components/automation-table-row';
import { useAutomationActions } from '../hooks/use-automation-actions';
import { automationSubline } from '../lib/automation-view';
import { automationTriggerText } from '../lib/trigger-text';

/**
 * The overview's Automations view (`product/versions/mvp/13-automations.md`):
 * one row per automation in the workspace, oldest first as the API lists
 * them. A row opens the automation's page; its menu edits, runs, pauses,
 * duplicates or deletes it in place. What an action could not do stays on
 * screen above the table.
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
  const actions = useAutomationActions({
    onDuplicated: (id) =>
      navigate({ to: '/automations/$automationId', params: { automationId: id } }),
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
      <ErrorAlert error={automations.error} fallback={t('automations.page.loadFailed')} />
      <RoutineTable>
        {automations.isPending ? (
          <div className="flex flex-col gap-1.5 p-1.5">
            <Skeleton className="h-[54px] w-full" />
            <Skeleton className="h-[54px] w-full" />
          </div>
        ) : automations.data?.length ? (
          <>
            <RoutineTableHead
              columns={[
                t('automations.table.automation'),
                t('automations.table.trigger'),
                t('automations.table.next'),
                t('automations.table.status'),
              ]}
            />
            {automations.data.map((automation) => (
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
                onDelete={() => actions.remove(automation.id)}
              />
            ))}
          </>
        ) : (
          <RoutineTableEmpty>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-hover-surface text-fg-muted [&_svg]:size-4">
              <Zap />
            </span>
            <span>{t('automations.page.empty')}</span>
          </RoutineTableEmpty>
        )}
      </RoutineTable>
    </div>
  );
}
