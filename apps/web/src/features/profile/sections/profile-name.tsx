import type { ProfileEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateMyProfile } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { ProfileForm } from '../forms/profile-form';

/**
 * Full name and username, and the save row under them. The write answers
 * with the whole profile, which the hook puts in the cache; the form takes
 * those values back, so after a save the card is clean and reads Saved.
 */
export function ProfileNameSection({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const update = useUpdateMyProfile();

  return (
    <ProfileForm
      values={{
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username ?? '',
      }}
      isPending={update.isPending}
      saved={update.isSuccess}
      error={
        update.isError
          ? resolveError(update.error, t('settings.profile.saveFailed')).message
          : undefined
      }
      onSubmit={(values) => update.mutate(values)}
      onDiscard={() => update.reset()}
    />
  );
}
