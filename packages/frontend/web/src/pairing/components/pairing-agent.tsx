import { Button, cn, Skeleton, Link as TextLink, useCopy } from '@oppenheimer/design-system-web';
import { ChevronDown, Copy } from '@oppenheimer/design-system-web/icons';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PairedMachine } from './pairing-chrome';
import type { PairingCommands } from './pairing-install';

/** `step`: onboarding's sizes. `dialog`: Add a host's. */
type PairingLayout = 'step' | 'dialog';

/** The 11px mono label the export puts over a pairing part ("Agent prompt", "Connection"). */
const EYEBROW = 'font-mono text-[11px] tracking-[0.02em] text-fg-subtle uppercase';

/**
 * The way in (`design/version1/AddHost.dc.html`, the console's Add a host in
 * `SessionsConsole.dc.html`): the prompt a person pastes into the coding
 * agent already on the machine. A card whose band reads "Agent prompt ·
 * Show" with Copy prompt, the primary, on its right; the prompt itself is
 * under the band, closed by default, because copying it is the action and
 * reading it is for whoever wants to first.
 */
export function PairingPrompt({
  pairing,
  layout = 'dialog',
}: {
  /** Absent while the token is being minted; Copy waits, disabled. */
  pairing: PairingCommands | null;
  layout?: PairingLayout;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopy(pairing?.agentPrompt ?? '');
  const step = layout === 'step';

  return (
    <div
      data-slot="pairing-prompt"
      className="flex flex-col overflow-hidden rounded-md border border-border-subtle bg-card"
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          step ? 'py-2.5 pr-2.5 pl-4' : 'py-2 pr-2 pl-3.5',
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(
            EYEBROW,
            'flex items-center gap-1.5 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
          )}
        >
          {t('hosts.pairing.agentPrompt')} ·{' '}
          {open ? t('hosts.pairing.hide') : t('hosts.pairing.show')}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.25 transition-transform duration-fast ease-standard',
              open && 'rotate-180',
            )}
          />
        </button>
        <Button type="button" size={step ? 'md' : 'sm'} disabled={!pairing} onClick={copy}>
          <Copy />
          {copied ? t('common.copied') : t('hosts.pairing.copyPrompt')}
        </Button>
      </div>
      {open &&
        (pairing ? (
          <pre
            className={cn(
              'm-0 overflow-y-auto overscroll-contain border-t border-border-subtle font-mono leading-[1.7] wrap-anywhere whitespace-pre-wrap text-fg',
              step ? 'max-h-50 px-4 py-3.5 text-xs' : 'max-h-45 px-3.5 py-3 text-[11.5px]',
            )}
          >
            {pairing.agentPrompt}
          </pre>
        ) : (
          <Skeleton className="h-32 w-full rounded-none" />
        ))}
    </div>
  );
}

/**
 * The token's line with "Install manually instead" across from it, and under
 * them, once asked for, the install command to run by hand: one line and a
 * Copy, with the installer's digest when the deployment published one.
 * `children` is the token's line (`PairingToken`).
 */
export function PairingManualInstall({
  pairing,
  layout = 'dialog',
  children,
}: {
  pairing: PairingCommands | null;
  layout?: PairingLayout;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopy(pairing?.installCommand ?? '');
  const step = layout === 'step';

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {children}
        <TextLink
          className={step ? 'text-[13px]' : 'text-xs'}
          render={<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} />}
        >
          {open ? t('hosts.pairing.manualHide') : t('hosts.pairing.manualShow')}
        </TextLink>
      </div>

      {open && (
        <div data-slot="pairing-command" className="flex flex-col gap-2">
          <span className="text-[13px] text-fg-muted">{t('hosts.pairing.manualLead')}</span>
          {pairing ? (
            <div className="flex items-center gap-2 rounded-sm border border-border-subtle bg-card py-1.5 pr-1.5 pl-3.5">
              <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-fg">
                {pairing.installCommand}
              </code>
              <Button type="button" variant="ghost" size="sm" className="flex-none" onClick={copy}>
                {copied ? t('common.copied') : t('common.copy')}
              </Button>
            </div>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {pairing?.installScriptSha256 ? (
            <span className="font-mono text-[11.5px] break-all text-fg-subtle">
              {t('hosts.pairing.installerDigest', { digest: pairing.installScriptSha256 })}
            </span>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Where a Connection row stands: behind the one in progress, on it, or past it. */
type RowState = 'done' | 'current' | 'next';

/**
 * The Connection list: what has happened on the machine so far, one row per
 * stage, each turning green with what the runner reported. Runner installed
 * is the host row appearing (the token spent, the runner registered, its
 * version); Host connected is the runner dialled in, with the machine's name
 * and OS.
 *
 * The export's third row, Tools on PATH (git · tmux · claude), waits for the
 * wire to carry the host's tools; the control plane does not report them yet.
 */
export function PairingConnection({
  host,
  layout = 'dialog',
}: {
  /** The machine this token paired, once one has spent it. */
  host: PairedMachine | null;
  layout?: PairingLayout;
}) {
  const { t } = useTranslation();
  const step = layout === 'step';
  const installed = host !== null;
  const connected = Boolean(host?.online);

  const rows: { key: string; state: RowState; label: string; detail: string | null }[] = [
    {
      key: 'installed',
      state: installed ? 'done' : 'current',
      label: installed ? t('hosts.pairing.installed') : t('hosts.pairing.installWaiting'),
      detail: host?.runnerVersion ? `v${host.runnerVersion.replace(/^v/, '')}` : null,
    },
    {
      key: 'connected',
      state: connected ? 'done' : installed ? 'current' : 'next',
      label: t('hosts.pairing.connected'),
      detail: host && connected ? [host.name, host.os].filter(Boolean).join(' · ') : null,
    },
  ];

  return (
    <div
      data-slot="host-pairing-status"
      className={cn('flex flex-col', step ? 'gap-3' : 'gap-1.5')}
    >
      <span className={EYEBROW}>{t('hosts.pairing.connection')}</span>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li
            key={row.key}
            data-state={row.state}
            className={cn(
              'grid grid-cols-[7px_minmax(0,1fr)_auto] items-center gap-x-3',
              step ? 'py-2.25' : 'py-2',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-1.75 rounded-pill',
                row.state === 'done' && 'bg-success',
                row.state === 'current' && 'animate-pulse-dot bg-fg-subtle',
                row.state === 'next' && 'bg-border',
              )}
            />
            <span
              className={cn(
                step ? 'text-sm' : 'text-[13px]',
                row.state === 'done' && 'text-fg',
                row.state === 'current' && 'text-fg-muted',
                row.state === 'next' && 'text-fg-subtle',
              )}
            >
              {row.label}
            </span>
            <span className="figures font-mono text-xs text-fg-muted">
              {row.state === 'done' ? row.detail : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
