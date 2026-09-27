import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
  SettingsSaveRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  useProfileSessions,
  useRevokeOtherProfileSessions,
  useRevokeProfileSession,
} from '@oppenheimer/frontend-consumer/react';
import { shareEntities, useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { DeviceLastSeen } from '../components/device-last-seen';

/**
 * Devices: every browser signed in to the account, this one first and
 * marked, each other one with Sign out, and Sign out of all other devices
 * under them once there is another. The list is a "do you recognise this?"
 * prompt, so a device reads as platform and browser, and when it was last
 * active.
 */
export function DevicesSection() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const devices = useProfileSessions({ structuralSharing: shareEntities });
  const revoke = useRevokeProfileSession();
  const revokeOthers = useRevokeOtherProfileSessions();
  const failure = revoke.error ?? revokeOthers.error;
  // This device first: it is the one row with nothing to do.
  const sorted = [...(devices.data ?? [])].sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <section className="flex flex-col gap-3">
      <SettingsHeading>{t('settings.devices.heading')}</SettingsHeading>
      {devices.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(devices.error, t('settings.devices.failed')).message}
          </AlertDescription>
        </Alert>
      ) : devices.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <SettingsGroup>
          {sorted.map((device) => (
            <SettingsRow
              key={device.id}
              label={device.deviceLabel ?? t('settings.devices.unknown')}
              hint={<DeviceLastSeen at={device.lastSeenAt} />}
            >
              {device.current ? (
                <Badge variant="neutral">{t('settings.devices.current')}</Badge>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending || revokeOthers.isPending}
                  onClick={() => revoke.mutate(device.id)}
                >
                  {t('settings.devices.signOut')}
                </Button>
              )}
            </SettingsRow>
          ))}
          {failure ? (
            <div className="border-t border-border-subtle px-5 py-3">
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(failure, t('settings.devices.revokeFailed')).message}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          {sorted.some((device) => !device.current) ? (
            <SettingsSaveRow>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={revoke.isPending || revokeOthers.isPending}
                onClick={() => revokeOthers.mutate()}
              >
                {t('settings.devices.signOutOthers')}
              </Button>
            </SettingsSaveRow>
          ) : null}
        </SettingsGroup>
      )}
    </section>
  );
}
