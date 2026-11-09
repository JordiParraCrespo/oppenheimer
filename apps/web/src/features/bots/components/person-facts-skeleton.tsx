import { SettingsGroup, SettingsListRowSkeleton, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { FactRowActionsSkeleton } from './fact-row-actions-skeleton';

/** Stands in for the count in the heading's sentence, which is split around it. */
const COUNT = '\u0000';

/**
 * Settings → Memory's learned facts before they answer, as `PersonFacts`
 * draws them: the heading written with its count a bar, the hint under it,
 * and three facts on the row's own frame with their controls off. Nothing is
 * added here, so there is no Clear all and no add row.
 */
export function PersonFactsSkeleton() {
  const { t } = useTranslation();
  const [before, after] = t('settings.memory.learnedTitle', {
    count: 2,
    replace: { count: COUNT },
  }).split(COUNT);
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <LoadingStatus />
      <div className="flex flex-col gap-1 px-1">
        <h2 className="eyebrow m-0 flex items-center">
          {before}
          <Skeleton shape="sm" className="ml-1 h-2.5 w-4" />
          {after}
        </h2>
        <p className="m-0 text-sm text-fg-subtle">{t('settings.memory.learnedHint')}</p>
      </div>
      <SettingsGroup>
        {[0, 1, 2].map((index) => (
          <SettingsListRowSkeleton key={index} index={index} actions={<FactRowActionsSkeleton />} />
        ))}
      </SettingsGroup>
    </section>
  );
}
