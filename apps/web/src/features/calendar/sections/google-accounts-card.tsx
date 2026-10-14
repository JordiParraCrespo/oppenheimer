import { SidebarListHead, Skeleton } from '@oppenheimer/design-system-web';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { GoogleAccountRows } from './google-account-rows';

/**
 * The viewer's Google accounts (`23-plan-milestones-stats-accounts.md` §5):
 * read-only, so connecting asks Google for the read scope alone. The rows
 * read the accounts under Suspense; this draws the card around them. Nothing
 * on a deployment with no Google credentials.
 */
export function GoogleAccountsCard() {
  const { t } = useTranslation();
  const { data: available } = useDeploymentCapabilities({
    select: (deployment) => deployment.google_calendar,
  });
  if (!available) return null;

  return (
    <section aria-label={t('calendar.google.accounts')} className="flex flex-col">
      <SidebarListHead label={t('calendar.google.accounts')} />
      <div className="mx-3 flex flex-col gap-2">
        <QueryState>
          <QueryState.Pending>
            <Skeleton className="h-16 w-full" />
          </QueryState.Pending>
          <QueryState.Error fallback={t('calendar.google.loadFailed')} />
          <QueryState.Data>
            <GoogleAccountRows />
          </QueryState.Data>
        </QueryState>
      </div>
    </section>
  );
}
