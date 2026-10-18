import { Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** The inventory's place while the hosts load. */
export function HostInventorySkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <Skeleton shape="lg" className="h-64 w-full" />
    </div>
  );
}
