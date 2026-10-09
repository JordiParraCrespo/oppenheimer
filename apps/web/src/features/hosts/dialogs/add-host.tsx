import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useHostsAvailability } from '../hooks/use-hosts-availability';
import { AddHostPairing } from '../sections/add-host-pairing';

/**
 * Add a host, pairing a machine without leaving the console
 * (`product/versions/mvp/05-screens.md`), behind the host chip's foot row.
 * Settings pairs on its own page (`/settings/hosts/new`).
 *
 * It asks the deployment first: on one that cannot pair (`hosts` off) it
 * mints nothing and says why, with Close as the only way on, rather than an
 * error under copy buttons with nothing to copy.
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
  const availability = useHostsAvailability();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('hosts.add.title')}</DialogTitle>
          <DialogDescription>{t('hosts.add.description')}</DialogDescription>
        </DialogHeader>

        {availability === 'available' ? (
          <AddHostPairing onClose={onClose} onUseHost={onUseHost} />
        ) : (
          <>
            <DialogBody>
              {availability === 'unavailable' ? (
                <Callout>{t('hosts.pairing.unavailable')}</Callout>
              ) : (
                <Skeleton className="h-32 w-full" />
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
