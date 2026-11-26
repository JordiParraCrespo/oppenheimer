import {
  BrandMark,
  Callout,
  EmptyState,
  IconButton,
  InboxList,
  SessionList,
  SidebarListHead,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oppenheimer/design-system-web';
import { CircleCheck, ExternalLink, RefreshCw } from '@oppenheimer/design-system-web/icons';
import type { TFunction } from 'i18next';
import { type ComponentType, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CLAUDE_ORIGIN } from '@/sessions/links';
import { NEEDS_YOU, type TrackedSession } from '@/sessions/session';
import type { SyncStatus } from '@/sessions/store';
import { byRecent } from '@/sessions/tracker';
import { age } from './age';
import { useNow } from './hooks/use-now';
import { useRefresh } from './hooks/use-refresh';
import { useStoredState } from './hooks/use-stored-state';
import { NeedsYouRow } from './needs-you-row';
import { OppenheimerSection } from './oppenheimer-section';
import { SessionRow } from './session-row';

/**
 * The popup: the Inbox cut down to Claude Code cloud sessions. What needs you
 * first; what is still running as a count and a list; what is done behind a
 * switch.
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
        <header className="flex items-center gap-2.5 px-1">
          <BrandMark size={22} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate font-semibold text-operate">{t('title')}</h1>
            {state.status?.ok ? (
              <p className="text-xs text-fg-subtle">{checkedText(t, age(state.status.at, now))}</p>
            ) : null}
          </div>
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
          <Section
            title={t('groups.needsYou')}
            sessions={needsYou}
            now={now}
            List={InboxList}
            Row={NeedsYouRow}
          />
        ) : state.status?.ok ? (
          <EmptyState compact>
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

        <OppenheimerSection
          connection={state.oppenheimer}
          report={state.report}
          runnerProblem={state.runnerProblem}
        />

        <a
          href={`${CLAUDE_ORIGIN}/code`}
          target="_blank"
          rel="noreferrer"
          className="-mx-3 flex items-center gap-1.5 border-border-subtle border-t px-5.5 pt-3 text-fg-muted text-sm transition-colors hover:text-fg"
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
  List = SessionList,
  Row = SessionRow,
}: {
  title: string;
  sessions: TrackedSession[];
  count?: number;
  action?: ReactNode;
  now: number;
  /** The list and its rows: one line each, or the Inbox's two for what needs you. */
  List?: ComponentType<{ children: ReactNode }>;
  Row?: ComponentType<{ session: TrackedSession; now: number }>;
}) {
  return (
    <section aria-label={title}>
      <SidebarListHead label={title} count={count}>
        {action}
      </SidebarListHead>
      {sessions.length > 0 && (
        <List>
          {sessions.map((session) => (
            <Row key={session.id} session={session} now={now} />
          ))}
        </List>
      )}
    </section>
  );
}

/** "Checked just now", "Checked 5m ago". */
function checkedText(t: TFunction, ago: string | undefined) {
  if (!ago || ago === 'now') return t('checked.now');
  return t('checked.ago', { age: ago });
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
