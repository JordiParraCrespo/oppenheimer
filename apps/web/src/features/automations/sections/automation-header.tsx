import {
  Alert,
  AlertDescription,
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
import { ChevronLeft, Ellipsis, Play } from '@oppenheimer/design-system-web/icons';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useConsoleDialog, useLocale } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NextRunCountdown } from '../components/next-run-countdown';
import { TriggerGlyph } from '../components/trigger-glyph';
import { useAutomationActions } from '../hooks/use-automation-actions';
import { automationDot, automationSubline } from '../lib/automation-view';
import { automationTriggerText } from '../lib/trigger-text';

/**
 * How an automation's page opens (the frame's `op-ph`): Back and the crumbs,
 * the glyph and the name with Run now, Edit and the ellipsis (pause or
 * resume, duplicate, delete behind a confirm), then the facts — status, the
 * countdown to the next run, the trigger, agent · model · project — and, while
 * paused, the band that says why with Resume.
 */
export function AutomationHeader({ automation }: { automation: AutomationEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const dialogs = useConsoleDialog();
  const resolveError = useErrorMessage();
  const [menu, setMenu] = useState<'closed' | 'actions' | 'confirm'>('closed');
  const { data: projectName } = useProjects({
    select: (projects) => projects.find((project) => project.id === automation.projectId)?.name,
  });
  const actions = useAutomationActions({
    onDuplicated: (id) =>
      navigate({ to: '/automations/$automationId', params: { automationId: id } }),
    onDeleted: () => navigate({ to: '/automations' }),
  });

  return (
    <PageHeader>
      <Link
        to="/automations"
        className="-ml-1 inline-flex w-fit items-center gap-1 text-[13px] text-fg-muted hover:text-fg md:hidden"
      >
        <ChevronLeft className="size-3.5" />
        {t('automations.detail.back')}
      </Link>
      <PageHeaderCrumbs>
        <Link to="/automations">{t('automations.detail.crumb')}</Link>
        <span>/</span>
        <PageHeaderHere>{automation.name}</PageHeaderHere>
      </PageHeaderCrumbs>
      <PageHeaderRow
        size="lg"
        icon={<TriggerGlyph scheduled={automation.isScheduled} size={17} />}
        title={automation.name}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => actions.runNow(automation)}
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
            <DropdownMenu
              open={menu !== 'closed'}
              onOpenChange={(open) => setMenu(open ? 'actions' : 'closed')}
            >
              <DropdownMenuTrigger
                render={<IconButton aria-label={t('automations.detail.more')} size="sm" />}
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-55">
                {menu === 'confirm' ? (
                  <div className="flex max-w-60 flex-col gap-2.5 px-2.5 pt-2 pb-1.5">
                    <span className="text-[13px] text-pretty text-fg-muted">
                      {t('automations.detail.confirmDelete')}
                    </span>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setMenu('closed')}>
                        {t('automations.detail.cancel')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setMenu('closed');
                          actions.remove(automation);
                        }}
                      >
                        {t('automations.detail.confirm')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => actions.setPaused(automation, !automation.isPaused)}
                    >
                      {automation.isPaused
                        ? t('automations.detail.resume')
                        : t('automations.detail.pause')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.duplicate(automation)}>
                      {t('automations.detail.duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      closeOnClick={false}
                      onClick={() => setMenu('confirm')}
                    >
                      {t('automations.detail.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <PageHeaderMeta>
        <StatusDot state={automationDot(automation)} className="items-center text-[13px]">
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
              onClick={() => actions.setPaused(automation, false)}
            >
              {t('automations.detail.resumeAction')}
            </Button>
          }
        >
          {t(`automations.pausedReason.${automation.pausedReason ?? 'user'}`)}
        </PageHeaderNote>
      ) : null}
      {actions.failure ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(actions.failure, t('automations.page.actionFailed')).message}
          </AlertDescription>
        </Alert>
      ) : null}
    </PageHeader>
  );
}
