'use client';

import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type * as React from 'react';

import { useControlled } from '../hooks/use-controlled';
import { type HostLinkState, LinkDot, useHostLink } from '../internal/host-link';
import { cn } from '../lib/utils';
import { TerminalStatusBar, TerminalStatusLink } from './terminal';

/**
 * HostLinkChrome — the bottom of a `Terminal`, drawn from the host link the
 * terminal was given (`<Terminal hostLink={{ phase, form, host }}>`). It
 * replaces the `TerminalStatusBar`; its children are the bar's items after
 * the link.
 *
 * The phase decides everything shown; a caller passes only what the design
 * system cannot know: the time offline, and the fix (the commands to run on
 * the host as a `CommandRowList`, and a link to Settings → Hosts).
 *
 * - **Live, reconnecting**: the status bar, its first item the link.
 * - **Offline, catching up, reconnected** in the `banner` form (the
 *   console's): the bar's place goes to a banner on a faint amber wash —
 *   the dot, the title, a dim line, the time offline — and while offline its
 *   one control, How to fix, opens a drawer above it with the fix.
 * - **Offline, catching up** in the `notice` form: the status bar stays, and
 *   a card over the faded scrollback says the same, with the fix under a
 *   hairline while offline. Once caught up the card goes and the bar says
 *   Reconnected.
 *
 * The session comes back on its own (the runner dials out), so the fix is
 * the only control, and it is for when it does not.
 */
function HostLinkChrome({
  elapsed,
  fix,
  fixOpen,
  defaultFixOpen = false,
  onFixOpenChange,
  children,
}: {
  /** Mono time since the host went away ("2m 14s"); shown while offline. */
  elapsed?: React.ReactNode;
  /** The fix: a `CommandRowList` (`surface="terminal"` in the drawer) and a link. */
  fix?: React.ReactNode;
  /** The banner's drawer, controlled. */
  fixOpen?: boolean;
  defaultFixOpen?: boolean;
  onFixOpenChange?: (open: boolean) => void;
  /** The status bar's items after the link. */
  children?: React.ReactNode;
}) {
  const link = useHostLink();
  const [open, setOpen] = useControlled({ value: fixOpen, defaultValue: defaultFixOpen, onChange: onFixOpenChange });
  const { phase, form, host, labels, row } = link;
  const offerFix = row.fix && fix !== undefined;

  if (form === 'banner' && row.banner) {
    return (
      <>
        {offerFix && open ? (
          <div
            data-slot="host-link-drawer"
            className="absolute inset-x-0 bottom-7 z-5 flex flex-col gap-3.5 border-t border-term-border bg-term-bg px-5 pt-4 pb-[18px] font-sans text-term-fg motion-safe:animate-appear-fast"
          >
            <p className="m-0 max-w-[62ch] text-[13.5px] leading-normal tracking-[-0.006em] text-pretty">
              {labels.fixIntro(host)}
            </p>
            {fix}
          </div>
        ) : null}
        <Banner link={link} elapsed={phase === 'offline' ? elapsed : undefined}>
          {offerFix ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-pill pr-2 pl-2.5 font-medium text-term-fg outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring"
            >
              {labels.fix}
              {open ? (
                <ChevronDownIcon className="size-[13px]" aria-hidden />
              ) : (
                <ChevronUpIcon className="size-[13px]" aria-hidden />
              )}
            </button>
          ) : null}
        </Banner>
      </>
    );
  }

  return (
    <>
      {form === 'notice' && row.card ? (
        <Notice link={link} elapsed={elapsed}>
          {offerFix ? fix : null}
        </Notice>
      ) : null}
      <TerminalStatusBar>
        <TerminalStatusLink state={row.link}>{labels.status[phase](host)}</TerminalStatusLink>
        {children}
      </TerminalStatusBar>
    </>
  );
}

type Away = 'offline' | 'catching-up' | 'reconnected';

/** The status bar's place while the host is away: the same 28px, an amber wash, a status region. */
function Banner({
  link: { phase, host, labels, row },
  elapsed,
  children,
}: {
  link: HostLinkState;
  elapsed?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const away = phase as Away;
  const title = labels.title[away](host);
  return (
    <div
      role="status"
      data-slot="host-link-banner"
      data-phase={phase}
      className="flex h-7 shrink-0 items-center gap-2.5 overflow-hidden border-t border-term-border bg-[color-mix(in_srgb,var(--term-warning)_9%,var(--term-bg))] pr-1.5 pl-5 font-sans text-xs tracking-[-0.004em] text-term-fg"
    >
      <LinkDot state={row.link} />
      <span key={title} className="shrink-0 font-medium motion-safe:animate-label-in">
        {title}
      </span>
      <span className="min-w-0 flex-1 truncate text-term-dim">{labels.line[away](host)}</span>
      {elapsed ? (
        <span className="figures shrink-0 font-mono text-[11.5px] text-term-dim">{elapsed}</span>
      ) : null}
      {children}
    </div>
  );
}

/** The card over the scrollback, clear of the status bar; scrolls itself when the pane is short. */
function Notice({
  link: { phase, host, labels, row },
  elapsed,
  children,
}: {
  link: HostLinkState;
  elapsed?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const away = phase as 'offline' | 'catching-up';
  const title = labels.title[away](host);
  return (
    <div
      data-slot="host-link-notice"
      className="pointer-events-none absolute inset-x-0 top-0 bottom-7 z-5 flex items-center justify-center p-4"
    >
      <div
        role="status"
        data-phase={phase}
        className={cn(
          'pointer-events-auto flex max-h-full w-full max-w-105 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card px-6 pt-[22px] pb-5 font-sans text-fg motion-safe:animate-appear',
        )}
      >
        <div className="flex flex-col gap-1.5">
          <span className="figures flex items-center gap-2 font-mono text-[11.5px] text-term-dim">
            <LinkDot state={row.link} />
            {labels.eyebrow[away]}
            {phase === 'offline' && elapsed ? <> · {elapsed}</> : null}
          </span>
          <h2 key={title} className="m-0 text-[17px] leading-[1.3] font-semibold tracking-[-0.016em] motion-safe:animate-label-in">
            {title}
          </h2>
          <p className="m-0 text-[13.5px] leading-normal text-fg-muted text-pretty">{labels.body[away](host)}</p>
        </div>
        {children ? (
          <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export { HostLinkChrome };
export type { HostLinkForm, HostLinkLabels, HostLinkPhase } from '../internal/host-link';
