import { Card } from '@oppenheimer/design-system-web';
import { Check } from '@oppenheimer/design-system-web/icons';
import type { InstallationEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * The connected GitHub account, as Connect GitHub shows it once the App is
 * installed: a success tick, the account login, and what it covers.
 *
 * An installation that covers the whole account says so; one with a chosen
 * list says how many. The count is not fetched here — a component renders
 * what it is handed — so the caller passes it when it has one.
 */
export function InstallationCard({
  installation,
  repositoryCount,
}: {
  installation: InstallationEntity;
  /** How many repositories the App can reach, when the caller knows. */
  repositoryCount?: number;
}) {
  const { t } = useTranslation();

  return (
    <Card className="flex-row items-center gap-3 px-[18px] py-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-success text-white">
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="figures text-[13px] text-fg">{installation.accountLogin}</span>
        {/* The account is known before the count is. While it is in flight the
            line names the account alone — "0 repositories" under a connection
            that just succeeded reads as a failure, which is the case Ready was
            written to avoid. */}
        <span className="text-xs text-fg-muted">
          {installation.coversEveryRepository
            ? t('onboarding.flow.github.connectedAll')
            : repositoryCount === undefined
              ? t('onboarding.flow.github.connectedPending')
              : t('onboarding.flow.github.connected', { count: repositoryCount })}
        </span>
      </span>
    </Card>
  );
}
