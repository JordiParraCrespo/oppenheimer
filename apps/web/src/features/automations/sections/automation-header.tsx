import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderNote,
  PageHeaderRow,
  PageHeaderSep,
  StatusDot,
} from '@oppenheimer/design-system-web';
import { Ellipsis, Play } from '@oppenheimer/design-system-web/icons';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert, useConsoleDialog, useLocale } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NextRunCountdown } from '../components/next-run-countdown';
import { TriggerGlyph } from '../components/trigger-glyph';
import { useAutomationActions } from '../hooks/use-automation-actions';
import { automationDot, automationSubline, pausedReasonText } from '../lib/automation-view';
import { runLocation } from '../lib/run-location';
import { automationTriggerText } from '../lib/trigger-text';

/**
 * How an automation's page opens (the frame's `op-ph`): Back and the crumbs,
 * the glyph and the name with Run now, Edit and the ellipsis (pause or
 * resume, duplicate, delete behind the same confirm as the table), then the
 * facts — status, the countdown to the next run, the trigger, agent · model ·
 * project — and, while paused, the band that says why with Resume.
 */
export function AutomationHeader({ automation }: { automation: AutomationEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const dialogs = useConsoleDialog();
  const [deleting, setDeleting] = useState(false);
  const { data: projectName } = useProjects({
    select: (projects) => projects.find((project) => project.id === automation.projectId)?.name,
  });
  const actions = useAutomationActions({
    onOpenRun: (run) => navigate(runLocation(run)),
    onDuplicated: (id) =>
      navigate({ to: '/automations/$automationId', params: { automationId: id } }),
    onDeleted: () => navigate({ to: '/automations' }),
  });

  return (
    <PageHeader>
      <PageHeaderCrumbs aria-label={t('common.breadcrumb')}>
        <Link to="/automations">{t('automations.detail.crumb')}</Link>
        <span>/</span>
        <PageHeaderHere>{automation.name}</PageHeaderHere>
      </PageHeaderCrumbs>
      <PageHeaderRow
        icon={<TriggerGlyph scheduled={automation.isScheduled} size={17} />}
        title={automation.name}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => actions.runNow(automation.id)}
              disabled={actions.running}
            >
              <Play />
              {t('automations.detail.runNow')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => dialogs.open({ kind: 'automation', automationId: automation.id })}
            >
              {t('automations.detail.edit')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<IconButton aria-label={t('automations.detail.more')} size="sm" />}
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-55">
                <DropdownMenuItem
                  onClick={() => actions.setPaused(automation.id, !automation.isPaused)}
                >
                  {automation.isPaused
                    ? t('automations.detail.resume')
                    : t('automations.detail.pause')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.duplicate(automation.id)}>
                  {t('automations.detail.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                  {t('automations.detail.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <PageHeaderMeta>
        <StatusDot
          state={automationDot(automation)}
          density="compact"
          pulse={automation.status === 'running'}
        >
          {t(`automations.status.${automation.status}`)}
        </StatusDot>
        <NextRunCountdown automation={automation} />
        <PageHeaderSep />
        <span>{automationTriggerText(automation, locale, t)}</span>
        <PageHeaderSep />
        <span>{automationSubline(automation, projectName)}</span>
      </PageHeaderMeta>
      {automation.isPaused ? (
        <PageHeaderNote
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => actions.setPaused(automation.id, false)}
            >
              {t('automations.detail.resumeAction')}
            </Button>
          }
        >
          {pausedReasonText(automation.pausedReason, t)}
        </PageHeaderNote>
      ) : null}
      <ErrorAlert
        error={actions.failure}
        fallback={t('automations.page.actionFailed')}
        onDismiss={actions.dismissFailure}
      />
      {deleting ? (
        <ConfirmDialog
          title={t('automations.deleteDialog.title', { name: automation.name })}
          description={t('automations.deleteDialog.description')}
          confirmLabel={t('automations.deleteDialog.confirm')}
          pendingLabel={t('automations.deleteDialog.deleting')}
          pending={actions.removing}
          error={actions.removeFailure}
          errorFallback={t('automations.deleteDialog.failed')}
          onClose={() => {
            actions.resetRemove();
            setDeleting(false);
          }}
          onConfirm={() => actions.remove(automation.id, automation.name)}
        />
      ) : null}
    </PageHeader>
  );
}
