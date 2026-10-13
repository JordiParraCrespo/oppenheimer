import {
  Button,
  cn,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Skeleton,
  useCopy,
} from '@oppenheimer/design-system-web';
import { Copy } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConnectionRowState, connectionRows } from '../lib/connection-rows';
import type { PairedMachine } from './pairing-chrome';
import type { PairingCommands } from './pairing-install';

/*
 * These parts are drawn inside `PairingChrome`, whose root carries
 * `data-layout` (`step` or `dialog`) and the `pairing` group. Each part sizes
 * itself from that attribute with `group-data-[layout=step]/pairing:` and
 * never takes the layout as a prop; outside the chrome they draw at the
 * dialog's sizes.
 */

/** The 11px mono label the export puts over a pairing part ("Connection"). */
const EYEBROW = 'font-mono text-[11px] tracking-[0.02em] text-fg-subtle uppercase';

const STATE_DOT: Record<ConnectionRowState, string> = {
  done: 'bg-success',
  current: 'animate-pulse-dot bg-fg-subtle',
  next: 'bg-border',
};

const STATE_INK: Record<ConnectionRowState, string> = {
  done: 'text-fg',
  current: 'text-fg-muted',
  next: 'text-fg-subtle',
};

/**
 * The way in (`design/version1/AddHost.dc.html`, the console's Add a host in
 * `SessionsConsole.dc.html`): the prompt a person pastes into the coding
 * agent already on the machine. A card whose band holds the fold's trigger,
 * "Agent prompt", and Copy prompt, the primary, on its right; the prompt
 * itself is the fold, closed by default, because copying it is the action
 * and reading it is for whoever wants to first.
 *
 * Only the onboarding step caps the prompt and scrolls it. In the dialog it
 * runs uncapped, because `DialogBody` already scrolls and a dialog gets one
 * scrollbar (`.agents/rules/frontend-ui.md`).
 */
export function PairingPrompt({
  pairing,
}: {
  /** Absent while the token is being minted; Copy waits, disabled. */
  pairing: PairingCommands | null;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(pairing?.agentPrompt ?? '');

  return (
    <Disclosure
      data-slot="pairing-prompt"
      className="overflow-hidden rounded-md border border-border-subtle bg-card"
    >
      <div className="flex items-center justify-between gap-3 py-2 pr-2 pl-3.5 group-data-[layout=step]/pairing:py-2.5 group-data-[layout=step]/pairing:pr-2.5 group-data-[layout=step]/pairing:pl-4">
        <DisclosureTrigger tone="muted" className="w-auto">
          {t('hosts.pairing.agentPrompt')}
        </DisclosureTrigger>
        <Button
          type="button"
          size="sm"
          className="group-data-[layout=step]/pairing:h-(--control-h-md) group-data-[layout=step]/pairing:px-(--control-pad-md) group-data-[layout=step]/pairing:text-operate"
          disabled={!pairing}
          onClick={copy}
        >
          <Copy />
          {copied ? t('common.copied') : t('hosts.pairing.copyPrompt')}
        </Button>
      </div>
      <DisclosurePanel className="mt-0 border-t border-border-subtle">
        {pairing ? (
          <pre className="m-0 px-3.5 py-3 font-mono text-[11.5px] leading-[1.7] wrap-anywhere whitespace-pre-wrap text-fg group-data-[layout=step]/pairing:max-h-50 group-data-[layout=step]/pairing:overflow-y-auto group-data-[layout=step]/pairing:overscroll-contain group-data-[layout=step]/pairing:px-4 group-data-[layout=step]/pairing:py-3.5 group-data-[layout=step]/pairing:text-xs">
            {pairing.agentPrompt}
          </pre>
        ) : (
          <Skeleton className="h-32 w-full rounded-none" />
        )}
      </DisclosurePanel>
    </Disclosure>
  );
}

/**
 * The token's line with "Install manually instead" across from it, a fold
 * whose panel is the install command to run by hand: one line and a Copy,
 * with the installer's digest when the deployment published one.
 * `children` is the token's line (`PairingToken`).
 */
export function PairingManualInstall({
  pairing,
  children,
}: {
  pairing: PairingCommands | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(pairing?.installCommand ?? '');

  return (
    <Disclosure className="gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {children}
        <DisclosureTrigger tone="muted" className="w-auto">
          {t('hosts.pairing.manual')}
        </DisclosureTrigger>
      </div>

      <DisclosurePanel data-slot="pairing-command" className="mt-0 gap-2">
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
      </DisclosurePanel>
    </Disclosure>
  );
}

/**
 * The Connection list: what has happened on the machine so far, one row per
 * stage (`connectionRows`), each turning green with what the runner
 * reported.
 *
 * The export's third row, Tools on PATH (git · tmux · claude), waits for the
 * wire to carry the host's tools; the control plane does not report them yet.
 */
export function PairingConnection({
  host,
}: {
  /** The machine this token paired, once one has spent it. */
  host: PairedMachine | null;
}) {
  const { t } = useTranslation();

  return (
    <div
      data-slot="host-pairing-status"
      className="flex flex-col gap-1.5 group-data-[layout=step]/pairing:gap-3"
    >
      <span className={EYEBROW}>{t('hosts.pairing.connection')}</span>
      <ul className="m-0 flex list-none flex-col p-0">
        {connectionRows(host).map((row) => (
          <li
            key={row.key}
            data-state={row.state}
            className="grid grid-cols-[7px_minmax(0,1fr)_auto] items-center gap-x-3 py-2 group-data-[layout=step]/pairing:py-2.25"
          >
            <span aria-hidden className={cn('size-1.75 rounded-pill', STATE_DOT[row.state])} />
            <span
              className={cn(
                'text-[13px] group-data-[layout=step]/pairing:text-sm',
                STATE_INK[row.state],
              )}
            >
              {t(`hosts.pairing.${row.label}` as const)}
            </span>
            <span className="figures font-mono text-xs text-fg-muted">{row.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
