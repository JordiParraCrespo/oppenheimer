import { SettingsTitle } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { WatchRepositorySearch } from '../sections/watch-repository-search';
import { WatchedRepositories } from '../sections/watched-repositories';

/**
 * Settings → Watched repositories (`design/version1/Settings.dc.html`): the
 * one place the queue's Watching scope is set. The title and its line, Watch
 * repositories on the right — a search over every repository the
 * installations reach — then a row per watched one.
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
      <WatchedRepositories />
    </>
  );
}
