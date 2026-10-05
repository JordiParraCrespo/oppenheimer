import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { PairingChrome } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { usePairing } from '../hooks/use-pairing';

/**
 * Add a host, pairing a machine without leaving the console
 * (`product/versions/mvp/05-screens.md`), behind the host chip's foot row. The
 * footer's primary arms on a **registered** host rather than an online one,
 * unlike onboarding's Continue (`usePairing`'s two rules). Settings pairs on
 * its own page (`/settings/hosts/new`).
 */
export function AddHostDialog({
  onClose,
  onUseHost,
}: {
  onClose: () => void;
  /** The paired machine, for the chip that asked for it. */
  onUseHost: (hostId: string) => void;
}) {
  const { t } = useTranslation();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done } = usePairing(
    t('hosts.add.defaultName'),
    'registered',
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('hosts.add.title')}</DialogTitle>
          <DialogDescription>{t('hosts.add.description')}</DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
