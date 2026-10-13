import {
  Badge,
  Button,
  EmptyState,
  SessionPaneHeader,
  Skeleton,
  Wordmark,
} from '@oppenheimer/design-system-web';
import { EyeIcon, TerminalIcon } from '@oppenheimer/design-system-web/icons';
import { useSharedSession } from '@oppenheimer/frontend-consumer/react';
import { RouteError } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SharedEndsIn } from '../components/shared-ends-in';
import { SharedFrame } from '../components/shared-frame';
import { SharedNotice } from '../components/shared-notice';
import { shareRefusalOf } from '../lib/share-session';
import { SharedSessionTerminal } from '../sections/shared-session-terminal';

/**
 * A session as a guest opens it (`ShareSession.dc.html`, kept to its
 * simplest): one bar — the wordmark, the session and its state, what the
 * share lets them do, until when, and Leave for someone who can write — and
 * the terminal under it. Every refusal is its own answer: sign in, not
 * shared with you, or not shared at all. When the relay closes the
 * terminal (the owner narrowed, stopped or changed the share), the page asks
 * again, so the bar and the terminal's input follow the share as it now is.
 */
export function SharedSessionScreen({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const shared = useSharedSession(slug);

  if (shared.isPending) {
    return (
      <SharedFrame>
        <Skeleton className="m-6 h-40" />
      </SharedFrame>
    );
  }
  if (shared.error) {
    const refusal = shareRefusalOf(shared.error);
    if (!refusal) return <RouteError error={shared.error} />;
    return (
      <SharedNotice
        title={t(`sessions.shared.${refusal}.title`)}
        body={t(`sessions.shared.${refusal}.body`)}
        action={
          refusal === 'signIn' ? (
            <Button render={<Link to="/login" search={{ redirect: `/s/${slug}` }} />}>
              {t('sessions.shared.signIn.action')}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const session = shared.data;
  const writing = session.access === 'write';
  return (
    <SharedFrame>
      <SessionPaneHeader
        back={<Wordmark size={14} />}
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
          onEnd={() => shared.refetch()}
        />
      )}
    </SharedFrame>
  );
}
