import { Button, DialogBody, DialogFooter } from '@oppenheimer/design-system-web';
import { PairingChrome } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { usePairing } from '../hooks/use-pairing';

/**
 * The Add a host dialog's body and footer while it pairs: mounting it mints
 * the token, so the dialog mounts it only on a deployment that can pair
 * (`useHostsAvailability`). The primary arms on a **registered** host rather
 * than an online one, unlike onboarding's Continue (`usePairing`'s two rules).
 */
export function AddHostPairing({
  onClose,
  onUseHost,
}: {
  onClose: () => void;
  onUseHost: (hostId: string) => void;
}) {
  const { t } = useTranslation();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done } = usePairing(
    t('hosts.add.defaultName'),
    'registered',
  );

  return (
    <>
      <DialogBody>
        <div className="flex flex-col gap-4.5">
          <PairingChrome
            pairing={pairing ?? null}
            expiresAt={expiresAt}
            expired={expired}
            onRegenerate={regenerate}
            busy={isPending}
            host={host}
            error={error}
          />
        </div>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled={!done} onClick={() => host && onUseHost(host.id)}>
          {t('hosts.add.use')}
        </Button>
      </DialogFooter>
    </>
  );
}
