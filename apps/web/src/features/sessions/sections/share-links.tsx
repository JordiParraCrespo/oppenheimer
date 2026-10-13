import { Skeleton } from '@oppenheimer/design-system-web';
import { useRevokeShareLink, useShareLinks } from '@oppenheimer/frontend-consumer/react';
import { type DataOf, ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ShareLinkRow } from '../components/share-link-row';

/**
 * A session's live share links, each revocable. Revoked and expired ones are
 * left out: they open nothing, and the API keeps them only for the record.
 * Revoking closes a terminal already open through the link within a minute.
 */
export function ShareLinks({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const links = useShareLinks(sessionId);
  const revoke = useRevokeShareLink();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-fg">{t('sessions.share.live')}</h3>
      <ErrorAlert error={revoke.error} fallback={t('sessions.share.revokeFailed')} />
      <QueryState query={links} isEmpty={(rows) => rows.every((link) => !link.live)}>
        <QueryState.Pending>
          <Skeleton className="h-10 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('sessions.share.listFailed')} />
        <QueryState.Empty>
          <p className="text-sm text-fg-muted">{t('sessions.share.none')}</p>
        </QueryState.Empty>
        <QueryState.Data>
          {(rows: DataOf<typeof links>) => (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {rows
                .filter((link) => link.live)
                .map((link) => (
                  <ShareLinkRow
                    key={link.id}
                    link={link}
                    revoking={revoke.isPending && revoke.variables?.linkId === link.id}
                    onRevoke={() => revoke.mutate({ sessionId, linkId: link.id })}
                  />
                ))}
            </ul>
          )}
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
