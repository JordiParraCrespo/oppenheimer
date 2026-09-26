import { Separator, StatusDot, Link as TextLink } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { TokenCountdown } from './token-countdown';

/**
 * A machine as the pairing chrome names it. Structural rather than
 * `HostEntity`: the kit imports no product package (`kit-knows-no-product`), and these three fields are all a status row reads.
 */
export interface PairingHost {
  name: string;
  /** Whether the runner is dialled in right now, as the API reports it. */
  online: boolean;
  os: string | null;
}

/**
 * The pairing chrome: the token's clock, the way to replace it, and the status
 * line that resolves in place when a runner spends it.
 *
 * One place because two surfaces show the same three facts — the onboarding
 * step (`apps/web/.../hosts/screens/onboarding-host.tsx`) and the console's
 * Add a host page — and a feature may not import another feature. What
 * differs between them is *above* this: the step lays the two forms of the
 * instruction out as cards, the page puts them behind a switch. What this
 * owns is everything below that, which the two had written twice.
 *
 * The page draws the two halves apart — the token line under its Install
 * step, the status row as its Connect step — so they are exported on their
 * own too, `HostPairingToken` and `HostPairingStatus`; this is the two
 * stacked with a rule between, which is the step's shape.
 *
 * `layout` is the export's two sizes, not a theme: the step's line is 12px on
 * the muted ramp (`design/version1/AddHost.dc.html`), the page's 11.5px on
 * the subtle one (`…/Components.dc.html`). Same vocabulary as `CodeBlock`.
 *
 * The status word says what the API said: a host row exists once the runner
 * registers, and `online` is the only thing the control plane reports about it.
 * The step's artboard draws a capability card — ✓ git, ✓ tmux — and that is not
 * this component's to invent: nothing on the wire carries the host's tools yet,
 * so the row says the runner is up or that it is still coming up, and the card
 * arrives with the capabilities themselves.
 */
export function HostPairingChrome({
  expiresAt,
  expired,
  onRegenerate,
  busy,
  host,
  layout = 'dialog',
}: {
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
  host: PairingHost | null;
  /** `step`: onboarding's 12px line. `dialog`: the 11.5px of Add a host. */
  layout?: 'step' | 'dialog';
}) {
  return (
    <>
      <HostPairingToken
        expiresAt={expiresAt}
        expired={expired}
        onRegenerate={onRegenerate}
        busy={busy}
        layout={layout}
      />
      <Separator />
      <HostPairingStatus host={host} layout={layout} />
    </>
  );
}

/** The token's clock and the way to replace it. */
export function HostPairingToken({
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
  layout?: 'step' | 'dialog';
}) {
  const { t } = useTranslation();
  const step = layout === 'step';

  return (
    <div
      className={
        step ? 'flex flex-wrap items-baseline gap-3' : 'flex items-baseline justify-between gap-3'
      }
    >
      <span
        className={
          step
            ? 'figures text-xs whitespace-nowrap text-fg-muted'
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

/** The status line that resolves in place when a runner spends the token. */
export function HostPairingStatus({
  host,
  layout = 'dialog',
}: {
  host: PairingHost | null;
  layout?: 'step' | 'dialog';
}) {
  const { t } = useTranslation();
  const step = layout === 'step';

  return (
    <div className={step ? 'flex min-h-13 flex-col justify-center' : 'flex min-h-13 items-center'}>
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
