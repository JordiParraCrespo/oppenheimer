import { EmptyState } from '@oppenheimer/design-system-web';
import { Server } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * Hosts: the machines you own that run sessions. Add host is one pasted
 * command carrying a one-hour registration token, and the host appears here
 * once its runner dials in (`product/versions/mvp/00-scope.md`). The list and
 * the pairing command arrive with the hosts API; this is the section they
 * land in.
 */
export function HostsSection() {
  const { t } = useTranslation();

  return (
    <EmptyState>
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Server />
        </EmptyState.Media>
        <EmptyState.Title>{t('settings.hosts.emptyTitle')}</EmptyState.Title>
        <EmptyState.Description>{t('settings.hosts.emptyDescription')}</EmptyState.Description>
      </EmptyState.Header>
    </EmptyState>
  );
}
