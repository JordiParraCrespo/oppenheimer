import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryErrorBoundary } from '@oppenheimer/frontend-web';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { HostListRows } from './host-list-rows';

/**
 * The hosts, one card each: the pilot of Suspense reads. The rows read the
 * list themselves and suspend until it answers, so this draws only the
 * boundaries: a skeleton in the card's place while they wait, and a first
 * failure as an `Alert` that says why, with Try again.
 */
export function HostList() {
  const { t } = useTranslation();

  return (
    <QueryErrorBoundary fallback={t('settings.hosts.failed')}>
      <Suspense fallback={<Skeleton className="h-18 w-full" />}>
        <HostListRows />
      </Suspense>
    </QueryErrorBoundary>
  );
}
