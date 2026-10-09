import { Button, RoutineStep, RoutineSteps } from '@oppenheimer/design-system-web';
import {
  ErrorAlert,
  PairingInstruction,
  PairingStatus,
  PairingToken,
} from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { usePairing } from '../hooks/use-pairing';
import { AddHostHeader } from './add-host-header';

/**
 * Settings' Add a host page while it pairs: the header's Cancel and Done, and
 * the Install and Connect steps, which tick done on the same event because
 * installing is what connects. Both finish on a registered host (`usePairing`'s
 * rules). Mounting it mints the token, so the page mounts it only on a
 * deployment that can pair (`useHostsAvailability`).
 */
export function AddHostSteps() {
  const { t } = useTranslation();
  const back = { to: '/settings/hosts' as const };
  const navigate = useNavigate();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done } = usePairing(
    t('hosts.add.defaultName'),
    'registered',
  );

  return (
    <>
      <AddHostHeader
        actions={
          <>
            <Button type="button" variant="secondary" size="sm" render={<Link {...back} />}>
              {t('common.cancel')}
            </Button>
            <Button type="button" size="sm" disabled={!done} onClick={() => navigate(back)}>
              {t('hosts.add.done')}
            </Button>
          </>
        }
      />

      <ErrorAlert error={error} fallback={t('hosts.pairing.mintFailed')} className="mb-6" />

      <RoutineSteps>
        <RoutineStep
          number={1}
          title={t('hosts.add.install.title')}
          subtitle={t('hosts.add.install.subtitle')}
          done={done}
          summary={t('hosts.add.install.done')}
        >
          <div className="flex flex-col gap-2">
            <PairingInstruction pairing={pairing ?? null} layout="panel" />

            <PairingToken
              expiresAt={expiresAt}
              expired={expired}
              onRegenerate={regenerate}
              busy={isPending}
            />
          </div>
        </RoutineStep>

        <RoutineStep
          number={2}
          title={t('hosts.add.connect.title')}
          subtitle={t('hosts.add.connect.subtitle')}
          done={done}
          summary={host ? [host.name, host.os].filter(Boolean).join(' · ') : undefined}
          last
        >
          <div className="rounded-md border border-border-subtle bg-card px-3.5">
            <PairingStatus host={host} />
          </div>
        </RoutineStep>
      </RoutineSteps>
    </>
  );
}
