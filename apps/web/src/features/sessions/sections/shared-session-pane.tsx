import { EmptyState, IconButton, StatusDot } from '@oppenheimer/design-system-web';
import { EyeIcon, LogOutIcon, TerminalIcon } from '@oppenheimer/design-system-web/icons';
import { useSuspenseSharedSession } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharedEndsIn } from '../components/shared-ends-in';
import { SharedFrame } from '../components/shared-frame';
import { useSessionChat } from '../hooks/use-session-chat';
import { DEFAULT_SESSION_VIEW, type PaneReading, type SessionView } from '../lib/chat-blocks';
import { shareRefusalOf } from '../lib/share-session';
import { SessionChat } from './session-chat';
import { SharedRefusal } from './shared-refusal';
import { SharedSessionTerminal } from './shared-session-terminal';
import { SharedViewSwitch } from './shared-view-switch';

/**
 * A session as a guest opens it, read the way a session reads in the
 * console: one bar with the session and its state, who shared it, until
 * when, what the share lets them do and Leave for someone who can edit, and
 * the terminal under it at the page's full width. Every refusal is its own answer: sign in, not shared with you,
 * or not shared at all. When the relay closes the terminal (the owner
 * narrowed, stopped or changed the share), the page asks again, so the bar
 * and the terminal's input follow the share as it now is.
 *
 * Read under Suspense, in `SharedSessionScreen`'s `QueryState.Data`. A
 * refetch the share now refuses says the refusal in the page's place; any
 * other that fails keeps the page and says so above it.
 *
 * The chat and how the page reads it are held here, as `SessionPane` holds a
 * member's: the terminal feeds the chat and draws it over its grid, and this
 * page paints the ground behind both, one colour for either view. A `read`
 * share's chat has no composer.
 */
export function SharedSessionPane({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { data: session, error, refetch } = useSuspenseSharedSession(slug);
  // A guest's chat is kept apart from a member's of the same session.
  const chat = useSessionChat(`share:${slug}`);
  const [view, setView] = useState<SessionView>(DEFAULT_SESSION_VIEW);
  const refusal = error ? shareRefusalOf(error) : null;
  if (refusal) return <SharedRefusal refusal={refusal} slug={slug} />;

  const writing = session.access === 'write';
  const reading: PaneReading = {
    chat,
    view,
    onViewChange: setView,
    cover: (
      <SessionChat
        chat={chat}
        agent={null}
        readOnly={!writing}
        onOpenTerminal={() => setView('terminal')}
      />
    ),
  };
  return (
    <SharedFrame
      title={session.name}
      meta={
        <>
          <StatusDot
            state={session.state === 'stopped' ? 'paused' : 'running'}
            density="compact"
            className="shrink-0 text-xs text-fg-muted"
          >
            <span className="sr-only sm:not-sr-only">
              {t(`sessions.shared.state.${session.state}`)}
            </span>
          </StatusDot>
          {session.sharedBy ? (
            <span className="hidden truncate text-xs text-fg-subtle md:inline">
              {t('sessions.shared.sharedBy', { name: session.sharedBy })}
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          {session.state === 'live' ? <SharedViewSwitch reading={reading} /> : null}
          <span className="flex items-center gap-1.5 px-1.5 text-xs text-fg-muted [&_svg]:size-3.5">
            {writing ? <TerminalIcon /> : <EyeIcon />}
            <span className="sr-only sm:not-sr-only">
              {writing ? t('sessions.shared.canWrite') : t('sessions.shared.viewOnly')}
            </span>
            {session.expiresAt ? (
              <span className="hidden text-fg-subtle sm:inline">
                · <SharedEndsIn at={session.expiresAt} />
              </span>
            ) : null}
          </span>
          {writing ? (
            <IconButton
              variant="quiet"
              size="sm"
              aria-label={t('sessions.shared.leave')}
              title={t('sessions.shared.leave')}
              render={<Link to="/" />}
            >
              <LogOutIcon />
            </IconButton>
          ) : null}
        </>
      }
    >
      <ErrorAlert error={error} fallback={t('sessions.screen.loadFailed')} className="m-4" />
      {session.state === 'stopped' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Title>{t('sessions.shared.stopped.title')}</EmptyState.Title>
              <EmptyState.Description>{t('sessions.shared.stopped.body')}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-term-bg">
          <SharedSessionTerminal
            slug={slug}
            readOnly={!writing}
            onEnd={() => refetch()}
            reading={reading}
          />
        </div>
      )}
    </SharedFrame>
  );
}
