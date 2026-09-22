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
  StatusDot,
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * How much of the block is shown before it scrolls; the rest is one copy away.
 * The agent prompt the server composes runs to thirty-odd lines, and uncapped
 * it pushes the status line and the footer off a short viewport.
 */
const CODE_MAX_LINES = 8;

/**
 * Add host — pairing a machine without leaving the console.
 *
 * The version-1 dialog, and the only one
 * (`product/versions/mvp/05-screens.md`): one instruction in two forms behind
 * a Command / Agent prompt switch, the token line, and a status line that
 * resolves in place so nothing below it moves. Until this existed the host
 * chip's foot action sent the reader back out to `/onboarding/host` — out of
 * the console, into a numbered step of a flow they had finished, with a Skip
 * link and a Continue that lands on Ready rather than back at the composer
 * they were filling in.
 *
 * It lives under `sessions/` because New session is the one surface that opens
 * it — the chip's foot action and the no-host empty state — and because the
 * host it pairs goes straight into that screen's draft. The pairing itself is
 * nobody's feature: the flow is `useHostPairing` in
 * `@oppenheimer/frontend-consumer`, shared with the onboarding step. When the
 * settings drawer arrives and wants the same dialog, this moves with the
 * second consumer.
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
  const { pairing, countdown, expired, host, isPending, error, regenerate } = useHostPairing(
    t('sessions.new.addHost.defaultName'),
  );
  // Which way the same instruction is being read. The dialog is the lowest
  // component that reads it, and the switch changes nothing else on screen.
  const [format, setFormat] = useState<'command' | 'prompt'>('command');

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
                  {resolveError(error, t('sessions.new.addHost.mintFailed')).message}
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
                  onValueChange={(next) => setFormat(next as 'command' | 'prompt')}
                  aria-label={t('sessions.new.addHost.format')}
                >
                  <SegmentedControlItem value="command">
                    {t('sessions.new.addHost.command')}
                  </SegmentedControlItem>
                  <SegmentedControlItem value="prompt">
                    {t('sessions.new.addHost.agentPrompt')}
                  </SegmentedControlItem>
                </SegmentedControl>
              </div>

              {pairing ? (
                <CodeBlock
                  layout="panel"
                  code={format === 'command' ? pairing.installCommand : pairing.agentPrompt}
                  maxLines={CODE_MAX_LINES}
                  copyLabel={t('common.copy')}
                  copiedLabel={t('common.copied')}
                />
              ) : (
                <Skeleton className="h-19 w-full" />
              )}

              <div className="flex items-baseline justify-between gap-3">
                <span className="figures text-[11.5px] whitespace-nowrap text-fg-subtle">
                  {/* An expired token can pair nothing, so the line says so
                      rather than counting down through zero. */}
                  {expired
                    ? t('sessions.new.addHost.tokenExpired')
                    : t('sessions.new.addHost.tokenExpires', { time: countdown })}
                </span>
                <TextLink
                  className="text-[11.5px] whitespace-nowrap"
                  render={<button type="button" onClick={regenerate} disabled={isPending} />}
                >
                  {t('sessions.new.addHost.newToken')}
                </TextLink>
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            <div className="flex min-h-13 items-center">
              {host ? (
                <div className="flex w-full flex-wrap items-center gap-2.5">
                  {/* Registered is not the same as dialled in: the installer can
                      finish, and the service still be starting. The dot follows
                      what the API reports rather than the fact a row appeared, or
                      a host whose runner never came up would read as running. */}
                  <StatusDot state={host.online ? 'running' : 'idle'} className="items-center">
                    <span className="figures text-[13px]">{host.name}</span>
                  </StatusDot>
                  {host.os && <span className="text-xs text-fg-muted">{host.os}</span>}
                  <span className="flex-1" />
                  <span className="text-xs text-fg-muted">
                    {host.online
                      ? t('sessions.new.addHost.ready')
                      : t('sessions.new.addHost.registered')}
                  </span>
                </div>
              ) : (
                <StatusDot state="pending" pulse>
                  {t('sessions.new.addHost.waiting')}
                </StatusDot>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {/* Registered is enough, unlike onboarding's Continue: a session may
              be started on a machine whose runner is still coming up — the
              control plane records it and owes it to that host the moment it
              connects, which is what the chip's offline rows mean too. */}
          <Button type="button" disabled={!host} onClick={() => host && onUseHost(host.id)}>
            {t('sessions.new.addHost.use')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
