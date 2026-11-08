import { RunHistorySkeleton as RunHistoryCardSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The run-history card's place while its read has not answered: the card
 * with its title, range and legend written and the bars still to come.
 * `link` stands for the card whose header links to the runs (the overview's
 * Automations tab) instead of printing the legend.
 */
export function RunHistorySkeleton({ link = false }: { link?: boolean }) {
  const { t } = useTranslation();
  return (
    <RunHistoryCardSkeleton
      aria-busy
      link={link}
      title={t('automations.history.title')}
      range={t('automations.history.range')}
      succeededLabel={t('automations.history.succeeded')}
      failedLabel={t('automations.history.failed')}
    >
      <LoadingStatus />
    </RunHistoryCardSkeleton>
  );
}
