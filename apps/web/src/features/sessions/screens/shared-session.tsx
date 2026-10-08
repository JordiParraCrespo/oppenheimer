import { Badge, Button, EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { useSharedSession } from '@oppenheimer/frontend-consumer/react';
import { RouteError } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SharedFrame } from '../components/shared-frame';
import { SharedNotice } from '../components/shared-notice';
import { useShareToken } from '../hooks/use-share-token';
import { keepShareToken, shareRefusalOf } from '../lib/share-links';
import { SharedSessionTerminal } from '../sections/shared-session-terminal';

/**
 * A session opened through a share link, signed in or not
 * (`product/versions/mvp/21-session-share-links.md`). The link's secret is
 * the URL's fragment; the page says what the link opens and who shared it,
 * then the terminal. Every refusal is its own answer: a link that opens
 * nothing, one that wants an account, one that is not for this account.
 */
export function SharedSessionScreen() {
  const { t } = useTranslation();
  const token = useShareToken();
  const shared = useSharedSession(token ?? undefined);

  if (!token)
    return (
      <SharedNotice title={t('sessions.shared.gone.title')} body={t('sessions.shared.gone.body')} />
    );
  if (shared.isPending) {
    return (
      <SharedFrame>
        <Skeleton className="m-6 h-40" />
      </SharedFrame>
    );
  }
  if (shared.error) {
    const refusal = shareRefusalOf(shared.error);
    if (refusal === 'sign_in') {
      return (
        <SharedNotice
          title={t('sessions.shared.signIn.title')}
          body={t('sessions.shared.signIn.body')}
          action={
            <Button
              render={<Link to="/login" search={{ redirect: '/shared' }} />}
              onClick={() => keepShareToken(token)}
            >
              {t('sessions.shared.signIn.action')}
            </Button>
          }
        />
      );
    }
    if (refusal) {
      return (
        <SharedNotice
          title={t(`sessions.shared.${refusal === 'gone' ? 'gone' : 'notInvited'}.title`)}
          body={t(`sessions.shared.${refusal === 'gone' ? 'gone' : 'notInvited'}.body`)}
        />
      );
    }
    return <RouteError error={shared.error} />;
  }

  const session = shared.data;
  return (
    <SharedFrame>
      <header className="flex flex-wrap items-center gap-2 px-5 py-3">
        <h1 className="min-w-0 truncate text-sm font-medium text-fg">{session.name}</h1>
        <Badge variant="neutral">
          {session.access === 'write'
            ? t('sessions.share.writeBadge')
            : t('sessions.share.readBadge')}
        </Badge>
        {session.sharedBy ? (
          <span className="text-xs text-fg-muted">
            {t('sessions.shared.sharedBy', { name: session.sharedBy })}
          </span>
        ) : null}
      </header>
      {session.state === 'stopped' ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>{t('sessions.shared.stopped.title')}</EmptyState.Title>
            <EmptyState.Description>{t('sessions.shared.stopped.body')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-3.5 pt-0">
          <SharedSessionTerminal token={token} readOnly={session.access === 'read'} />
        </div>
      )}
    </SharedFrame>
  );
}
