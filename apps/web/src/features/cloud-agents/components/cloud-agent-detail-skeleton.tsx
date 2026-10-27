import { Skeleton, SummaryCard, SummaryRow } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * A cloud agent before it answers: its title and status as bars, the facts
 * card with its labels written and a bar per value, and what it was asked as
 * two lines.
 */
export function CloudAgentDetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div aria-hidden className="flex flex-col gap-2">
        <div className="flex h-8 items-center">
          <Skeleton shape="sm" className="h-5 w-2/3" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-40" />
        </div>
      </div>
      <SummaryCard aria-hidden>
        {(['repository', 'model', 'branch'] as const).map((label) => (
          <SummaryRow key={label} label={t(`sessions.cloudAgents.detail.${label}`)}>
            <Skeleton shape="sm" className="h-3 w-36" />
          </SummaryRow>
        ))}
      </SummaryCard>
      <div aria-hidden className="flex flex-col gap-2">
        <span className="eyebrow">{t('sessions.cloudAgents.detail.prompt')}</span>
        <div className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-full" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-1/2" />
        </div>
      </div>
      <LoadingStatus />
    </div>
  );
}
