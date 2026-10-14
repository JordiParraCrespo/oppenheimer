import { Badge, Button, EmptyState, SessionPaneHeader } from '@oppenheimer/design-system-web';
import { EyeIcon, TerminalIcon } from '@oppenheimer/design-system-web/icons';
import { useSuspenseSharedSession } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SharedEndsIn } from '../components/shared-ends-in';
import { SharedFrame } from '../components/shared-frame';
import { shareRefusalOf } from '../lib/share-session';
import { SharedRefusal } from './shared-refusal';
import { SharedSessionTerminal } from './shared-session-terminal';

/**
 * A session as a guest opens it (`ShareSession.dc.html`, kept to its
 * simplest): under the wordmark, one card — a bar with the session and its
 * state, what the share lets them do, until when, and Leave for someone who
 * can edit — and the terminal under it. Every refusal is its own answer: sign in, not
 * shared with you, or not shared at all. When the relay closes the
 * terminal (the owner narrowed, stopped or changed the share), the page asks
 * again, so the bar and the terminal's input follow the share as it now is.
 *
 * Read under Suspense, in `SharedSessionScreen`'s `QueryState.Data`. A
 * refetch the share now refuses says the refusal in the page's place; any
 * other that fails keeps the page and says so above it.
 */
export function SharedSessionPane({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { data: session, error, refetch } = useSuspenseSharedSession(slug);
  const refusal = error ? shareRefusalOf(error) : null;
  if (refusal) return <SharedRefusal refusal={refusal} slug={slug} />;

  const writing = session.access === 'write';
  return (
    <SharedFrame>
      <ErrorAlert error={error} fallback={t('sessions.screen.loadFailed')} className="m-4" />
      <SessionPaneHeader
        name={session.name}
        state={session.state === 'stopped' ? 'paused' : 'running'}
        stateLabel={t(`sessions.shared.state.${session.state}`)}
        meta={session.expiresAt ? <SharedEndsIn at={session.expiresAt} /> : undefined}
        actions={
          <>
            <Badge variant="neutral">
              {writing ? <TerminalIcon /> : <EyeIcon />}
              {writing ? t('sessions.shared.canWrite') : t('sessions.shared.viewOnly')}
            </Badge>
            {writing ? (
              <Button variant="ghost" size="sm" render={<Link to="/" />}>
                {t('sessions.shared.leave')}
              </Button>
            ) : null}
          </>
        }
      />
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
        <SharedSessionTerminal
          slug={slug}
          readOnly={!writing}
          sharedBy={session.sharedBy}
          onEnd={() => refetch()}
        />
      )}
    </SharedFrame>
  );
}
