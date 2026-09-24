import { StatusDot, Link as TextLink } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

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

/** `mm:ss`, from the seconds the flow hook counts down. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The pairing chrome: the token's clock, the way to replace it, and the status
 * line that resolves in place when a runner spends it.
 *
 * One component because two surfaces show the same three facts — the
 * onboarding step (`apps/web/.../hosts/screens/onboarding-host.tsx`) and the
 * console's Add host dialog — and a feature may not import another feature.
 * What differs between them is *above* this: the step lays the two forms of
 * the instruction out as cards, the dialog puts them behind a switch. What
 * this owns is everything below that, which the two had written twice.
 *
 * `layout` is the export's two sizes, not a theme: the step's line is 12px on
 * the muted ramp (`design/version1/AddHost.dc.html`), the dialog's 11.5px on
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
  secondsLeft,
  expired,
  onRegenerate,
  busy,
  host,
  layout = 'dialog',
}: {
  /** What is left on the token, counted down by the flow hook. */
  secondsLeft: number;
  expired: boolean;
  onRegenerate: () => void;
  /** While a fresh token is being minted. */
  busy?: boolean;
  /** The machine this token paired, once one has spent it. */
  host: PairingHost | null;
  /** `step`: onboarding's 12px line. `dialog`: the 11.5px of Add host. */
  layout?: 'step' | 'dialog';
}) {
  const { t } = useTranslation();
  const step = layout === 'step';

  return (
    <>
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
          {expired
            ? t('hosts.pairing.tokenExpired')
            : t('hosts.pairing.tokenExpires', { time: clock(secondsLeft) })}
        </span>
        <TextLink
          className={step ? 'text-xs' : 'text-[11.5px] whitespace-nowrap'}
          render={<button type="button" onClick={onRegenerate} disabled={busy} />}
        >
          {t('hosts.pairing.newToken')}
        </TextLink>
      </div>

      <div className="h-px bg-border-subtle" />

      <div
        className={step ? 'flex min-h-13 flex-col justify-center' : 'flex min-h-13 items-center'}
      >
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
    </>
  );
}
