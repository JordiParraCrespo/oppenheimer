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
          <h1 className="flex-1 font-medium text-operate">Claude Code sessions</h1>
          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  size="sm"
                  aria-label="Check now"
                  disabled={refreshing}
                  onClick={() => void refresh()}
                />
              }
            >
              <RefreshCw className={refreshing ? 'motion-safe:animate-spin' : undefined} />
            </TooltipTrigger>
            <TooltipContent>Check now</TooltipContent>
          </Tooltip>
        </header>

        <SyncCallout status={state.status} />

        {needsYou.length > 0 ? (
          <Section title="Needs you" sessions={needsYou} now={now} />
        ) : state.status?.ok ? (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <CircleCheck />
              </EmptyState.Media>
              <EmptyState.Title>You're clear</EmptyState.Title>
              <EmptyState.Description>
                {running.length === 0
                  ? 'Nothing is running.'
                  : `${running.length} ${running.length === 1 ? 'session is' : 'sessions are'} still running.`}{' '}
                You'll get a notification when one needs you.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : null}

        {running.length > 0 && <Section title="Running" sessions={running} now={now} />}

        {done.length > 0 && (
          <Section
            title="Done"
            sessions={showDone ? done : []}
            count={done.length}
            now={now}
            action={
              <Switch
                size="sm"
                aria-label="Show done"
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
          Open claude.ai/code
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

const PROBLEM: Record<Extract<SyncStatus, { ok: false }>['problem'], string> = {
  'signed-out': 'Sign in to claude.ai in this Chrome, then check again.',
  'not-found':
    "Couldn't find your sessions yet. Open claude.ai/code once and the extension will learn where they are.",
  unreachable: "Couldn't reach claude.ai. It will try again in a minute.",
};

function SyncCallout({ status }: { status: SyncStatus | undefined }) {
  if (!status) {
    return <Callout>Checking your sessions…</Callout>;
  }
  if (status.ok) return null;
  return (
    <Callout tone="warning" title={status.detail}>
      {PROBLEM[status.problem]}
    </Callout>
  );
}
