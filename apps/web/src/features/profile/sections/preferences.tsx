import { Alert, AlertDescription, Skeleton } from '@oppenheimer/design-system-web';
import { useUpdateUserSettings, useUserSettings } from '@oppenheimer/frontend-core/react';
import { SectionCard, SectionHead, useErrorMessage } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { PreferencesForm } from '@/features/profile/forms/preferences-form';

export function PreferencesSection() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const settings = useUserSettings();
  const update = useUpdateUserSettings();

  const disabled = settings.isPending || update.isPending;
  const failure = settings.error ?? update.error;

  if (settings.isPending) {
    return (
      <>
        <SectionHead
          title={t('profile.preferences.title')}
          sub={t('profile.preferences.description')}
        />
        <SectionCard>
          <div className="flex flex-col gap-3 p-[18px]">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <SectionHead
        title={t('profile.preferences.title')}
        sub={t('profile.preferences.description')}
      />

      {failure && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(failure).message}</AlertDescription>
        </Alert>
      )}

      <PreferencesForm
        saved={settings.data}
        disabled={disabled}
        onSubmit={(values) => update.mutate(values)}
      />
    </>
  );
}
