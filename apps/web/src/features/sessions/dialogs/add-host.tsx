import {
  Alert,
  AlertDescription,
  Button,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { HostPairingChrome } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * How much of the block is shown before it scrolls; the rest is one copy away.
 * The agent prompt the server composes runs to thirty-odd lines, and uncapped
 * it pushes the status line and the footer off a short viewport.
 */
const CODE_MAX_LINES = 8;

/** The two ways to read one instruction, and the key each reads its label by. */
const FORMATS = ['command', 'agentPrompt'] as const;
type Format = (typeof FORMATS)[number];

const isFormat = (value: string): value is Format => (FORMATS as readonly string[]).includes(value);

/**
 * Add host — pairing a machine without leaving the console.
 *
 * The version-1 dialog, and the only one
 * (`product/versions/mvp/05-screens.md`): one instruction in two forms behind
 * a Command / Agent prompt switch, then the pairing chrome — the token line
 * and a status line that resolves in place so nothing below it moves. Until
 * this existed the host chip's foot action sent the reader back out to
 * `/onboarding/host`, into a numbered step of a flow they had finished.
 *
 * What is *this* dialog's is what the artboard draws differently from the
 * onboarding step: the switch, the panel, and a footer whose primary arms on a
 * **registered** host rather than an online one. Everything below the panel is
 * `HostPairingChrome` from the platform kit, and the flow under it is
 * `useHostPairing` — the step runs both too.
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
  /** The paired machine, for the screen that asked for it. */
  onUseHost: (hostId: string) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { pairing, secondsLeft, expired, host, isPending, error, regenerate } = useHostPairing(
    t('sessions.new.addHost.defaultName'),
  );
  // Which way the same instruction is being read. The dialog is the lowest
  // component that reads it, and the switch changes nothing else on screen.
  const [format, setFormat] = useState<Format>('command');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('sessions.new.addHost.title')}</DialogTitle>
          <DialogDescription>{t('sessions.new.addHost.description')}</DialogDescription>
        </DialogHeader>

        {/* The 18px rhythm the export gives the dialog's middle sits on a
            plain wrapper: `DialogBody` owns its padding, and restyling a
            component that owns a thing is what `lint:design` forbids. */}
        <DialogBody>
          <div className="flex flex-col gap-4.5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(error, t('hosts.pairing.mintFailed')).message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex-1 text-sm font-medium text-fg">
                  {t('sessions.new.addHost.instruction')}
                </span>
                <SegmentedControl
                  value={format}
                  onValueChange={(next) => {
                    // `SegmentedControl` speaks strings; the guard is what
                    // keeps that at the boundary instead of casting it away.
                    if (isFormat(next)) setFormat(next);
                  }}
                  aria-label={t('sessions.new.addHost.format')}
                >
                  {FORMATS.map((option) => (
                    <SegmentedControlItem key={option} value={option}>
                      {t(`sessions.new.addHost.${option}` as const)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </div>

              {pairing ? (
                <CodeBlock
                  layout="panel"
                  code={format === 'command' ? pairing.installCommand : pairing.agentPrompt}
                  maxLines={CODE_MAX_LINES}
                  note={
                    format === 'command' && pairing.installScriptSha256
                      ? t('hosts.pairing.installerDigest', { digest: pairing.installScriptSha256 })
                      : undefined
                  }
                  copyLabel={t('common.copy')}
                  copiedLabel={t('common.copied')}
                />
              ) : (
                <Skeleton className="h-19 w-full" />
              )}
            </div>

            <HostPairingChrome
              secondsLeft={secondsLeft}
              expired={expired}
              onRegenerate={regenerate}
              busy={isPending}
              host={host}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {/* Registered is enough here, where onboarding's Continue waits for
              online: a session may be started on a machine whose runner is
              still coming up — the control plane records it and owes it to
              that host the moment it connects, which is the same fact the
              chip's offline rows carry (`05-screens.md`). */}
          <Button type="button" disabled={!host} onClick={() => host && onUseHost(host.id)}>
            {t('sessions.new.addHost.use')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
