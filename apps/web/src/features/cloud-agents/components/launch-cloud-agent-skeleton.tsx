import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * `/cloud` before the status says whether a vendor is connected: the launch
 * form, the quieter of its two shapes, with its labels written and each
 * field a bar at its own height.
 */
export function LaunchCloudAgentSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div aria-hidden className="flex h-5 items-center">
        <Skeleton shape="sm" className="h-3 w-3/5" />
      </div>
      <div aria-hidden className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">
          {t('sessions.cloudAgents.launch.prompt')}
        </span>
        <Skeleton className="h-28 w-full" />
      </div>
      <div aria-hidden className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg">
            {t('sessions.cloudAgents.launch.repository')}
          </span>
          <Skeleton shape="pill" className="h-8 w-48" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg">
            {t('sessions.cloudAgents.launch.model')}
          </span>
          <Skeleton shape="pill" className="h-8 w-40" />
        </div>
      </div>
      <LoadingStatus />
    </div>
  );
}
