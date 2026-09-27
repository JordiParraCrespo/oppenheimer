import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  HostPairingCopyButtons,
  HostPairingInspect,
  HostPairingStatus,
  HostPairingToken,
} from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Add a host — pairing a machine without leaving the console
 * (`product/versions/mvp/05-screens.md`, the 2026-09-27 export).
 *
 * A 520px dialog behind the host chip's foot row: one sentence, then the two
 * copy buttons — the way in is copying the instruction, not reading it —
 * the token line under them, the command and the prompt behind an Inspect
 * fold, and a status box that resolves in place when a runner spends the
 * token. Everything under the sentence is the kit's pairing parts, which
 * the onboarding step draws too; the flow under both is `useHostPairing`.
 *
 * The footer's primary arms on a **registered** host rather than an online
 * one, unlike onboarding's Continue: a session may be started on a machine
 * whose runner is still coming up — the control plane records it and owes
 * it to that host the moment it connects. Settings pairs on its own page
 * (`/settings/hosts/new`), inside its frame.
 *
 * Both forms of the instruction come from the API with the secret already
 * in them: it is shown once, the server is the only place that knows it, so
 * neither string is assembled here.
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
  const resolveError = useErrorMessage();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate } = useHostPairing(
    t('hosts.add.defaultName'),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="max-w-130">
        <DialogHeader>
          <DialogTitle>{t('hosts.add.title')}</DialogTitle>
          <DialogDescription>{t('hosts.add.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4.5">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(error, t('hosts.pairing.mintFailed')).message}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2.5">
              <HostPairingCopyButtons pairing={pairing ?? null} />
              <HostPairingToken
                expiresAt={expiresAt}
                expired={expired}
                onRegenerate={regenerate}
                busy={isPending}
                layout="inline"
              />
            </div>

            <HostPairingInspect pairing={pairing ?? null} />

            <div className="rounded-md border border-border-subtle px-3.5">
              <HostPairingStatus host={host} />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={!host} onClick={() => host && onUseHost(host.id)}>
            {t('hosts.add.use')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
