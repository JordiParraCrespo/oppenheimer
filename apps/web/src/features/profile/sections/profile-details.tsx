import {
  Alert,
  AlertDescription,
  SettingsGroup,
  SettingsRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useMyProfile } from '@oppenheimer/frontend-consumer/react';
import { shareEntities, useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { ProfileEmailSection } from './profile-email';
import { ProfileNameSection } from './profile-name';
import { ProfilePictureSection } from './profile-picture';

/**
 * The profile card: picture, email, then the name and username the save row
 * commits. One query, and every row below reads the entity it returns — each
 * row owns its own write, so uploading a picture does not reset a name that
 * is half typed.
 */
export function ProfileDetailsSection() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const profile = useMyProfile({ structuralSharing: shareEntities });

  if (profile.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {resolveError(profile.error, t('settings.profile.failed')).message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!profile.data) {
    return (
      <SettingsGroup aria-busy>
        {[0, 1, 2, 3].map((row) => (
          <SettingsRow key={row} label={<Skeleton className="h-4 w-28" />}>
            <Skeleton className="h-8 w-40" />
          </SettingsRow>
        ))}
      </SettingsGroup>
    );
  }

  return (
    <ProfileNameSection profile={profile.data}>
      <ProfilePictureSection profile={profile.data} />
      <ProfileEmailSection profile={profile.data} />
    </ProfileNameSection>
  );
}
