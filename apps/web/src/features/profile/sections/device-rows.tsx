import {
  Badge,
  Button,
  SettingsGroup,
  SettingsRow,
  SettingsSaveRow,
} from '@oppenheimer/design-system-web';
import {
  useRevokeOtherProfileSessions,
  useRevokeProfileSession,
  useSuspenseProfileSessions,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { ErrorAlert, notifySuccess, RelativeTime } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The devices, in `DevicesSection`'s `QueryState.Data`: this one first and
 * marked, each other one with Sign out, and Sign out of all other devices
 * under them once there is another. A refetch that fails keeps the rows and
 * says so above them.
 */
export function DeviceRows() {
  const { t } = useTranslation();
  const { data: rows, error } = useSuspenseProfileSessions();
  const revoke = useRevokeProfileSession();
  const revokeOthers = useRevokeOtherProfileSessions({
    onSuccess: () => notifySuccess('otherDevicesSignedOut'),
  });
  const failure = lastFailure([revoke, revokeOthers]);
  // One sign-out at a time: the row in flight is pending, and the rest wait.
  const busy = revoke.isPending || revokeOthers.isPending;
  // This device first: it is the one row with nothing to do.
  const sorted = [...rows].sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.devices.failed')} />
      <SettingsGroup>
        {sorted.map((device) => (
          <SettingsRow
            key={device.id}
            label={device.deviceLabel ?? t('settings.devices.unknown')}
            hint={
              // On a clock of its own: the tick redraws this line, not the list.
              <RelativeTime date={device.lastSeenAt}>
                {(when) =>
                  when ? t('settings.devices.lastSeen', { when }) : t('settings.devices.activeNow')
                }
              </RelativeTime>
            }
          >
            {device.current ? (
              <Badge variant="neutral">{t('settings.devices.current')}</Badge>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                pending={revoke.isPending && revoke.variables === device.id}
                pendingLabel={t('settings.devices.signingOut')}
                disabled={busy}
                onClick={() => {
                  // The row's own label, from the click: the list drops it
                  // the moment the write lands.
                  const name = device.deviceLabel ?? t('settings.devices.unknown');
                  revoke.mutate(device.id, {
                    onSuccess: () => notifySuccess('deviceSignedOut', { name }),
                  });
                }}
              >
                {t('settings.devices.signOut')}
              </Button>
            )}
          </SettingsRow>
        ))}
        {failure.error ? (
          <div className="border-t border-border-subtle px-5 py-3">
            <ErrorAlert
              error={failure.error}
              fallback={t('settings.devices.revokeFailed')}
              onDismiss={failure.dismiss}
            />
          </div>
        ) : null}
        {sorted.some((device) => !device.current) ? (
          <SettingsSaveRow>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              pending={revokeOthers.isPending}
              pendingLabel={t('settings.devices.signingOutOthers')}
              disabled={revoke.isPending}
              onClick={() => revokeOthers.mutate()}
            >
              {t('settings.devices.signOutOthers')}
            </Button>
          </SettingsSaveRow>
        ) : null}
      </SettingsGroup>
    </>
  );
}
