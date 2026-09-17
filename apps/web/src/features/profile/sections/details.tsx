import { Alert, AlertDescription } from '@oppenheimer/design-system-web';
import type { ProfileEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateMyProfile } from '@oppenheimer/frontend-consumer/react';
import { SectionHead, useErrorMessage } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { DetailsForm, toDetailsFormValues } from '@/features/profile/forms/details-form';

export function DetailsSection({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const update = useUpdateMyProfile();

  return (
    <>
      <SectionHead title={t('profile.details.title')} sub={t('profile.details.description')} />

      {update.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(update.error).message}</AlertDescription>
        </Alert>
      )}

      <DetailsForm
        values={toDetailsFormValues(profile)}
        email={profile.email}
        isPending={update.isPending}
        onSubmit={(values) =>
          update.mutate({
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone.trim() || null,
            jobTitle: values.jobTitle.trim() || null,
          })
        }
      />
    </>
  );
}
