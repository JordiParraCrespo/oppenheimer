import { useSuspenseMyProfile } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ProfileEmailSection } from './profile-email';
import { ProfileNameSection } from './profile-name';
import { ProfilePictureSection } from './profile-picture';

/**
 * The profile card's rows, in `ProfileDetailsSection`'s `QueryState.Data`.
 * One query, and every row below reads the entity it returns — each row owns
 * its own write, so uploading a picture does not reset a name that is half
 * typed. A refetch that fails keeps the rows and says so above them.
 */
export function ProfileDetailsRows() {
  const { t } = useTranslation();
  const { data: profile, error } = useSuspenseMyProfile();

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.profile.failed')} />
      <ProfileNameSection profile={profile}>
        <ProfilePictureSection profile={profile} />
        <ProfileEmailSection profile={profile} />
      </ProfileNameSection>
    </>
  );
}
