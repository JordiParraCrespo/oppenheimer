import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { WatchedRepositoriesSkeleton } from '../components/watched-repositories-skeleton';
import { WatchRepositorySearch } from '../sections/watch-repository-search';
import { WatchedRepositories } from '../sections/watched-repositories';

/**
 * Settings → Watched repositories (`design/version1/Settings.dc.html`): the
 * one place the queue's Watching scope is set. The title and its line, Watch
 * repositories on the right — a search over every repository the
 * installations reach — then a row per watched one, read under Suspense.
 */
export function WatchedRepositoriesSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.repositories.title')}
        description={t('settings.repositories.description')}
        action={<WatchRepositorySearch />}
      />
      <QueryState>
        <QueryState.Pending>
          <WatchedRepositoriesSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('pullRequests.watch.loadFailed')} />
        <QueryState.Data>
          <WatchedRepositories />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
