import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostListRows } from './host-list-rows';

/**
 * The hosts, one card each: the pilot of Suspense reads. The rows read the
 * list themselves and suspend until it answers, so this composes only the
 * read's other states: a skeleton in the card's place while they wait, and a
 * first failure as an `Alert` that says why, with Try again.
 */
export function HostList() {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <Skeleton className="h-18 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.hosts.failed')} />
      <QueryState.Data>
        <HostListRows />
      </QueryState.Data>
    </QueryState>
  );
}
