import { SettingsGroup, SettingsRow, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
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
        <SettingsGroup aria-busy>
          {[0, 1, 2, 3].map((row) => (
            <SettingsRow key={row} label={<Skeleton className="h-4 w-28" />}>
              <Skeleton className="h-8 w-40" />
            </SettingsRow>
          ))}
        </SettingsGroup>
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.profile.failed')} />
      <QueryState.Data>
        <ProfileDetailsRows />
      </QueryState.Data>
    </QueryState>
  );
}
