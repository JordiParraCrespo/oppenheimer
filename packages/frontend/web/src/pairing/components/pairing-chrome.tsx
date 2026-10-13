import { cn, Separator, Link as TextLink } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';
import { PairingConnection, PairingManualInstall, PairingPrompt } from './pairing-agent';
import type { PairingCommands } from './pairing-install';
import { TokenCountdown } from './token-countdown';

/**
 * A machine as the pairing chrome names it. Structural rather than
 * `HostEntity`: the kit imports no product package (`kit-knows-no-product`),
 * and these fields are all the status rows read.
 */
export interface PairedMachine {
  name: string;
  /** Whether the runner is dialled in right now, as the API reports it. */
  online: boolean;
  os: string | null;
  /** The runner's version, as it reported it on registering. */
  runnerVersion: string | null;
}

/**
 * The pairing column, agent first (`design/version1/AddHost.dc.html`, the
 * 2026-10-13 export): the agent prompt to paste into the coding agent on the
 * machine, the token's clock and the way to replace it with "Install manually
 * instead" across from them, a rule, and the Connection list that turns green
 * as the runner installs and dials in.
 *
 * The onboarding step and the console's Add a host dialog draw it. `layout`
 * is the export's two sizes: the step's 12px prompt and 14px rows, the
 * dialog's 11.5px prompt and 13px rows (`SessionsConsole.dc.html`). Settings
 * shows the instruction outright, so it composes `PairingToken`,
 * `PairingInstruction` and `PairingStatus`.
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
  return (
    <>
      <ErrorAlert error={error} fallback={t('hosts.pairing.mintFailed')} />
      <PairingPrompt pairing={pairing} layout={layout} />
      <PairingManualInstall pairing={pairing} layout={layout}>
        <PairingToken
          expiresAt={expiresAt}
          expired={expired}
          onRegenerate={onRegenerate}
          busy={busy}
          layout={layout}
        />
      </PairingManualInstall>
      <Separator />
      <PairingConnection host={host} layout={layout} />
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

/**
 * Settings' Connect row, drawn as the frames draw it
 * (`design/version1/Settings.dc.html`): a 7px dot, 13px words, inside a 44px
 * card the page provides. The status word says only what the API reports: a
 * host row exists once the runner registers, and `online` is all the control
 * plane says about it.
 */
export function PairingStatus({ host }: { host: PairedMachine | null }) {
  const { t } = useTranslation();

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
