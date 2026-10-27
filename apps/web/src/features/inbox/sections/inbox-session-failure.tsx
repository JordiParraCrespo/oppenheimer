import { InboxCardBody } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useSessionStartProgress } from '@oppenheimer/frontend-consumer/react';
import { useStartFailure } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Why a failed session did not start, on its Inbox card: the same reason its
 * page gives, read off its start log, and the host's own words in a small
 * line under it. A failed launch cannot be restarted, so the reason is the
 * card's answer. While the log loads, or when it names no reason, the card
 * says what it said before.
 */
export function InboxSessionFailure({
  session,
  fallback,
}: {
  session: SessionEntity;
  fallback: string;
}) {
  const { t } = useTranslation();
  const progress = useSessionStartProgress(session.id, { starting: false, failed: true });
  const failure = useStartFailure(progress.data?.failure, fallback);

  return (
    <>
      <InboxCardBody>{failure?.reason ?? fallback}</InboxCardBody>
      {failure?.detail ? (
        <p className="-mt-2 text-xs break-words text-fg-subtle">
          {t('inbox.session.failedDetail', { detail: failure.detail })}
        </p>
      ) : null}
    </>
  );
}
