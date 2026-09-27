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
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from '@oppenheimer/design-system-web';
import { Bot, Copy } from '@oppenheimer/design-system-web/icons';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  HostInstallInstruction,
  HostPairingStatus,
  HostPairingToken,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** How long a copy button reads "Copied" before it goes back to its verb. */
const COPIED_MS = 1800;

type Copied = 'command' | 'prompt' | null;

/**
 * Add a host — pairing a machine without leaving New session, from the host
 * chip's foot action (`design/version1/SessionsConsole.dc.html`, the
 * `host-title` dialog; a page between the 2026-09-26 evening export and the
 * 2026-09-27 one).
 *
 * What the frame asks for first is one action: copy the command, or copy the
 * agent prompt for an agent already on the machine. The instruction itself —
 * the Command / Agent prompt panel Settings' page shows open — folds behind
 * "Inspect command and prompt", then the token line and the status row that
 * resolves in place when a runner spends the token. The panel, the token line
 * and the status row are the kit's, shared with Settings → Hosts → Add a host
 * (`features/hosts/screens/add-host.tsx`); `useHostPairing` is the flow under
 * both.
 *
 * Use this host arms on a **registered** host rather than an online one,
 * unlike onboarding's Continue: a session may be started on a machine whose
 * runner is still coming up — the control plane records it and owes it to
 * that host the moment it connects. It hands the machine back to the chip,
 * which picks it for the next session.
 *
 * Both forms of the instruction come from the API with the secret already in
 * them: it is shown once, the server is the only place that knows it, so
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
  // Which copy button reads "Copied". A stale timer only ever clears its own
  // word, so a second copy is never cut short by the first.
  const [copied, setCopied] = useState<Copied>(null);

  function copy(kind: Exclude<Copied, null>, text: string | undefined) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        setTimeout(() => setCopied((current) => (current === kind ? null : current)), COPIED_MS);
      },
      // Clipboard denied: the instruction is still under Inspect to select.
      () => {},
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-130">
        <DialogHeader>
          <DialogTitle>{t('hosts.add.title')}</DialogTitle>
          <DialogDescription>{t('hosts.add.dialog.description')}</DialogDescription>
        </DialogHeader>

        {/* The 18px rhythm the frame gives the dialog's middle sits on a
            plain wrapper: `DialogBody` owns its padding. */}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!pairing}
                  onClick={() => copy('command', pairing?.installCommand)}
                >
                  <Copy />
                  {copied === 'command' ? t('common.copied') : t('hosts.add.dialog.copyCommand')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!pairing}
                  onClick={() => copy('prompt', pairing?.agentPrompt)}
                >
                  <Bot />
                  {copied === 'prompt' ? t('common.copied') : t('hosts.add.dialog.copyPrompt')}
                </Button>
              </div>
              <HostPairingToken
                expiresAt={expiresAt}
                expired={expired}
                onRegenerate={regenerate}
                busy={isPending}
              />
            </div>

            <Disclosure>
              <DisclosureTrigger variant="quiet">{t('hosts.add.dialog.inspect')}</DisclosureTrigger>
              <DisclosurePanel>
                <div className="pt-2.5">
                  <HostInstallInstruction instruction={pairing} />
                </div>
              </DisclosurePanel>
            </Disclosure>

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
