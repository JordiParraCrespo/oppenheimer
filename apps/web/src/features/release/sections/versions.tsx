import { SettingsHeading } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { VersionsSkeleton } from '../components/versions-skeleton';
import { VersionRows } from './version-rows';

/**
 * Versions: the console's and the API's side by side, so a reader can tell
 * when a deploy updated one and not the other. The rows read the API's under
 * Suspense.
 */
export function VersionsSection() {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3">
      <SettingsHeading>{t('settings.about.versionsHeading')}</SettingsHeading>
      <QueryState>
        <QueryState.Pending>
          <VersionsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.about.failed')} />
        <QueryState.Data>
          <VersionRows />
        </QueryState.Data>
      </QueryState>
    </section>
  );
}
