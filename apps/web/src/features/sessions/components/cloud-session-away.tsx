import { AgentMark, Button, EmptyState } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import { cloudProviderLabel, type SessionEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * A cloud session's page: it has no terminal of ours, so the page says where
 * it runs, what its vendor last said, and opens the vendor's own page, where
 * it is followed up and stopped (`SessionsConsole.dc.html`: a cloud row opens
 * the vendor). Reached from the Inbox or an address; its sidebar row goes to
 * the vendor directly.
 */
export function CloudSessionAway({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const cloud = session.cloud;
  if (!cloud) return null;
  const vendor = cloudProviderLabel(cloud.provider);

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <AgentMark agent={session.agent} />
        </EmptyState.Media>
        <EmptyState.Title>{session.name}</EmptyState.Title>
        <EmptyState.Description>
          {t(`sessions.cloud.status.${cloud.status}`, { vendor })}
          {session.scopeLabel ? ` · ${session.scopeLabel}` : null}
        </EmptyState.Description>
      </EmptyState.Header>
      {cloud.url ? (
        <EmptyState.Content>
          <Button render={<a href={cloud.url} target="_blank" rel="noreferrer" />}>
            <ExternalLink />
            {t('sessions.cloud.openAt', { vendor })}
          </Button>
        </EmptyState.Content>
      ) : null}
    </EmptyState>
  );
}
