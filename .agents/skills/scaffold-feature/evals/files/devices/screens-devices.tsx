import { useProfileSessions } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { DeviceList } from '@/features/profile/sections/device-list';

export function DevicesScreen() {
  const { t } = useTranslation();
  const sessions = useProfileSessions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('profile.devices.title')}</h1>
      <DeviceList sessions={sessions.data ?? []} loading={sessions.isLoading} />
    </div>
  );
}
