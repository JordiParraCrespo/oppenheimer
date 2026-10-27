import {
  BrandMark,
  Callout,
  EmptyState,
  IconButton,
  SessionList,
  SidebarListHead,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oppenheimer/design-system-web';
import { CircleCheck, ExternalLink, RefreshCw } from '@oppenheimer/design-system-web/icons';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CLAUDE_ORIGIN } from '@/sessions/links';
import { NEEDS_YOU, type TrackedSession } from '@/sessions/session';
import type { SyncStatus } from '@/sessions/store';
import { byRecent } from '@/sessions/tracker';
import { useNow } from './hooks/use-now';
import { useRefresh } from './hooks/use-refresh';
import { useStoredState } from './hooks/use-stored-state';
import { OppenheimerSection } from './oppenheimer-section';
import { SessionRow } from './session-row';

/**
 * The popup: the Inbox (`product/versions/mvp/design/version1/Brain.dc.html`)
 * cut down to Claude Code cloud sessions. What needs you first; what is still
 * running as a count and a list; what is done behind a switch.
 */
export function App() {
  const { t } = useTranslation();
  const state = useStoredState();
  const now = useNow();
  const [showDone, setShowDone] = useState(false);
  const { refreshing, refresh } = useRefresh();

  if (!state) return null;

  const sessions = Object.values(state.sessions).sort(byRecent);
  const needsYou = sessions.filter((session) => NEEDS_YOU.has(session.state));
  const running = sessions.filter((session) => session.state === 'running');
  const done = sessions.filter(
    (session) => session.state === 'done' || session.state === 'stopped',
  );

  return (
    <TooltipProvider>
      <div className="flex w-90 flex-col gap-3 p-3 text-fg">
        <header className="flex items-center gap-2">
          <BrandMark size={20} />
          <h1 className="flex-1 font-medium text-operate">{t('title')}</h1>
          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  size="sm"
                  aria-label={t('checkNow')}
                  disabled={refreshing}
                  onClick={() => void refresh()}
                />
              }
            >
              <RefreshCw className={refreshing ? 'motion-safe:animate-spin' : undefined} />
            </TooltipTrigger>
            <TooltipContent>{t('checkNow')}</TooltipContent>
          </Tooltip>
        </header>

        <SyncCallout status={state.status} />

        {needsYou.length > 0 ? (
          <Section title={t('groups.needsYou')} sessions={needsYou} now={now} />
        ) : state.status?.ok ? (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <CircleCheck />
              </EmptyState.Media>
              <EmptyState.Title>{t('clear.title')}</EmptyState.Title>
              <EmptyState.Description>
                {running.length === 0
                  ? t('clear.nothingRunning')
                  : t('clear.stillRunning', { count: running.length })}{' '}
                {t('clear.notify')}
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : null}

        {running.length > 0 && <Section title={t('groups.running')} sessions={running} now={now} />}

        {done.length > 0 && (
          <Section
            title={t('groups.done')}
            sessions={showDone ? done : []}
            count={done.length}
            now={now}
            action={
              <Switch
                size="sm"
                aria-label={t('groups.showDone')}
                checked={showDone}
                onCheckedChange={setShowDone}
              />
            }
          />
        )}

        <OppenheimerSection connection={state.oppenheimer} report={state.report} />

        <a
          href={`${CLAUDE_ORIGIN}/code`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 border-border border-t px-2.5 pt-3 text-fg-muted text-sm hover:text-fg"
        >
          {t('openClaude')}
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </TooltipProvider>
  );
}

/** A list under the sidebar's list head: its name, its count, and any control. */
function Section({
  title,
  sessions,
  count = sessions.length,
  action,
  now,
}: {
  title: string;
  sessions: TrackedSession[];
  count?: number;
  action?: ReactNode;
  now: number;
}) {
  return (
    <section aria-label={title}>
      <SidebarListHead label={title} count={count}>
        {action}
      </SidebarListHead>
      {sessions.length > 0 && (
        <SessionList>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} now={now} />
          ))}
        </SessionList>
      )}
    </section>
  );
}

/** The catalog key for each way a check can fail. */
const PROBLEM = {
  'signed-out': 'sync.signedOut',
  'not-found': 'sync.notFound',
  unreachable: 'sync.unreachable',
} as const satisfies Record<Extract<SyncStatus, { ok: false }>['problem'], string>;

function SyncCallout({ status }: { status: SyncStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) {
    return <Callout>{t('sync.checking')}</Callout>;
  }
  if (status.ok) return null;
  return (
    <Callout tone="warning" title={status.detail}>
      {t(PROBLEM[status.problem])}
    </Callout>
  );
}
