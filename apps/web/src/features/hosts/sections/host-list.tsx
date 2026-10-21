import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostListSkeleton } from '../components/host-list-skeleton';
import { HostListRows } from './host-list-rows';

/**
 * The hosts, one card each, read under Suspense. The rows read the
 * list themselves and suspend until it answers, so this composes only the
 * read's other states: the cards' shape in their place while they wait, and a
 * first failure as an `Alert` that says why, with Try again.
 */
export function HostList() {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <HostListSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.hosts.failed')} />
      <QueryState.Data>
        <HostListRows />
      </QueryState.Data>
    </QueryState>
  );
}
