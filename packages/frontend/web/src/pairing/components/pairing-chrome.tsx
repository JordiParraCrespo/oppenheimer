import { cn, Separator, StatusDot, Link as TextLink } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';
import { type PairingCommands, PairingCopyButtons, PairingInstruction } from './pairing-install';
import { TokenCountdown } from './token-countdown';

/**
 * A machine as the pairing chrome names it. Structural rather than
 * `HostEntity`: the kit imports no product package (`kit-knows-no-product`),
 * and these three fields are all a status row reads.
 */
export interface PairedMachine {
  name: string;
  /** Whether the runner is dialled in right now, as the API reports it. */
  online: boolean;
  os: string | null;
}

/**
 * The pairing column: the copy buttons, the token's clock and the way to
 * replace it, the instruction behind its fold, a rule, and the status line
 * that resolves in place when a runner spends the token.
 *
 * The onboarding step and the console's Add a host dialog draw it. `layout`
 * is the export's two sizes: the step's large buttons and 12px line
 * (`design/version1/AddHost.dc.html`), the dialog's medium buttons and 11.5px
 * line (`SessionsConsole.dc.html`). Settings shows the instruction outright,
 * so it composes `PairingToken`, `PairingInstruction` and `PairingStatus`.
 *
 * The status word says only what the API reports: a host row exists once the
 * runner registers, and `online` is all the control plane says about it. The
 * artboard's capability card (✓ git, ✓ tmux) waits for the wire to carry the
 * host's tools.
 */
export function PairingChrome({
  pairing,
  expiresAt,
  expired,
  onRegenerate,
  busy,
  host,
  error = null,
  layout = 'dialog',
}: {
  /** Absent while the token is being minted. */
  pairing: PairingCommands | null;
  /**
   * When the token runs out. The countdown ticks in `TokenCountdown`, so a
   * second passing re-renders that line and not this chrome or its surface.
   */
  expiresAt: Date | null;
  expired: boolean;
  onRegenerate: () => void;
  /** While a fresh token is being minted. */
  busy?: boolean;
  /** The machine this token paired, once one has spent it. */
  host: PairedMachine | null;
  /** A mint that was refused. The last token, if any, stays on screen and spendable. */
  error?: unknown;
  /** `step`: onboarding's sizes. `dialog`: Add a host's. */
  layout?: 'step' | 'dialog';
}) {
  const { t } = useTranslation();
  const step = layout === 'step';
  return (
    <>
      <ErrorAlert error={error} fallback={t('hosts.pairing.mintFailed')} />
      <div className="flex flex-col gap-2.5">
        <PairingCopyButtons pairing={pairing} size={step ? 'lg' : 'md'} />
        <PairingToken
          expiresAt={expiresAt}
          expired={expired}
          onRegenerate={onRegenerate}
          busy={busy}
          layout={layout}
        />
      </div>
      <PairingInstruction pairing={pairing} layout="fold" />
      <Separator />
      <PairingStatus host={host} layout={layout} />
    </>
  );
}

export function PairingToken({
  expiresAt,
  expired,
  onRegenerate,
  busy,
  layout = 'dialog',
}: {
  expiresAt: Date | null;
  expired: boolean;
  onRegenerate: () => void;
  busy?: boolean;
  /** `step`: onboarding's 12px line. `dialog`: the 11.5px of Add a host. */
  layout?: 'step' | 'dialog';
}) {
  const { t } = useTranslation();
  const step = layout === 'step';

  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <span
        className={
          step
            ? 'figures text-xs whitespace-nowrap text-fg-subtle'
            : 'figures text-[11.5px] whitespace-nowrap text-fg-subtle'
        }
      >
        {/* An expired token can pair nothing, so the line says so rather
              than counting down through zero. */}
        {expired ? (
          t('hosts.pairing.tokenExpired')
        ) : expiresAt ? (
          <TokenCountdown expiresAt={expiresAt} />
        ) : null}
      </span>
      <TextLink
        className={step ? 'text-xs' : 'text-[11.5px] whitespace-nowrap'}
        render={<button type="button" onClick={onRegenerate} disabled={busy} />}
      >
        {t('hosts.pairing.newToken')}
      </TextLink>
    </div>
  );
}

export function PairingStatus({
  host,
  layout = 'dialog',
}: {
  host: PairedMachine | null;
  layout?: 'step' | 'dialog';
}) {
  const { t } = useTranslation();
  const step = layout === 'step';

  if (!step) {
    // Add a host's Connect row, drawn as the frames draw it
    // (`design/version1/SessionsConsole.dc.html`, `Settings.dc.html`): a 7px
    // dot, 13px words, inside a 44px card the page provides.
    return (
      <div data-slot="host-pairing-status" className="flex min-h-10.5 flex-col justify-center">
        {host ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              aria-hidden
              className={cn(
                'size-1.75 shrink-0 rounded-pill',
                host.online ? 'bg-success' : 'bg-fg-subtle',
              )}
            />
            <span className="font-mono text-[13px] text-fg">{host.name}</span>
            {host.os ? <span className="text-xs text-fg-muted">{host.os}</span> : null}
            <span className="flex-1" />
            <span className="text-xs text-fg-muted">
              {host.online ? t('hosts.pairing.online') : t('hosts.pairing.registered')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-[13px] text-fg-muted">
            <span
              aria-hidden
              className="size-1.75 shrink-0 animate-pulse-dot rounded-pill bg-fg-subtle"
            />
            {t('hosts.pairing.waiting')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-13 flex-col justify-center">
      {host ? (
        <div className="flex w-full flex-wrap items-center gap-2.5">
          {/* Registered is not the same as dialled in: the installer can
                finish, and the service still be starting. The dot follows what
                the API reports rather than the fact a row appeared, or a host
                whose runner never came up would read as running. */}
          <StatusDot state={host.online ? 'running' : 'idle'} className="items-center">
            <span className="figures text-[13px]">{host.name}</span>
          </StatusDot>
          {host.os ? <span className="text-xs text-fg-muted">{host.os}</span> : null}
          <span className="flex-1" />
          <span className="text-xs text-fg-muted">
            {host.online ? t('hosts.pairing.online') : t('hosts.pairing.registered')}
          </span>
        </div>
      ) : (
        <StatusDot state="pending" pulse>
          {t('hosts.pairing.waiting')}
        </StatusDot>
      )}
    </div>
  );
}
