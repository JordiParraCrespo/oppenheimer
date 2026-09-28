import {
  Alert,
  AlertDescription,
  RoutineTable,
  RoutineTableEmpty,
  RoutineTableHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useAutomations, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog, useConsoleDialog, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
 *
 * Delete asks first, like the automation's own page. The table owns which
 * row's confirm is open, because a row's menu unmounts when it closes.
 */
export function AutomationsTable() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const dialogs = useConsoleDialog();
  const resolveError = useErrorMessage();
  const automations = useAutomations();
  const { data: projectNames } = useProjects({
    select: (projects) => new Map(projects.map((project) => [project.id, project.name])),
  });
  const [deleting, setDeleting] = useState<AutomationEntity | null>(null);
  const actions = useAutomationActions({
    onDuplicated: (id) =>
      navigate({ to: '/automations/$automationId', params: { automationId: id } }),
    onDeleted: () => setDeleting(null),
  });

  return (
    <div className="flex flex-col gap-3">
      {actions.failure ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(actions.failure, t('automations.page.actionFailed')).message}
          </AlertDescription>
        </Alert>
      ) : null}
      {automations.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(automations.error, t('automations.page.loadFailed')).message}
          </AlertDescription>
        </Alert>
      ) : null}
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
                onRunNow={() => actions.runNow(automation)}
                onTogglePause={() => actions.setPaused(automation, !automation.isPaused)}
                onDuplicate={() => actions.duplicate(automation)}
                onDelete={() => setDeleting(automation)}
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
      {deleting ? (
        <ConfirmDialog
          title={t('automations.table.confirmDeleteTitle', { name: deleting.name })}
          description={t('automations.table.confirmDelete')}
          confirmLabel={t('automations.table.delete')}
          pending={actions.removing}
          error={actions.removeFailure}
          onClose={() => setDeleting(null)}
          onConfirm={() => actions.remove(deleting)}
        />
      ) : null}
    </div>
  );
}
