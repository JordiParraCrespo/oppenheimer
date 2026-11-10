import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ProfileDetailsSkeleton } from '../components/profile-details-skeleton';
import { ProfileDetailsRows } from './profile-details-rows';

/**
 * The profile card: picture, email, then the name and username the save row
 * commits. The rows read the profile under Suspense; this draws the card
 * until they can, and the failure if the first read fails.
 */
export function ProfileDetailsSection() {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <ProfileDetailsSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.profile.failed')} />
      <QueryState.Data>
        <ProfileDetailsRows />
      </QueryState.Data>
    </QueryState>
  );
}
