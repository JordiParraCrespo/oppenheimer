import * as React from 'react';

import { cn } from '../lib/utils';

/** The link dot's three looks. */
type TerminalLinkState = 'live' | 'reconnecting' | 'offline';

/**
 * Where a session's link to its host stands. `live` and `reconnecting` (a
 * blip the console rides out) are the status bar's; `offline`, then
 * `catching-up` once the runner is back and missed output replays, then
 * `reconnected` for a moment, are the host going away and coming back.
 */
type HostLinkPhase = 'live' | 'reconnecting' | 'offline' | 'catching-up' | 'reconnected';

/**
 * How the pane draws a host that went away. `banner` (the console's form)
 * takes the status bar's place; `notice` is the frames' other drawing of the
 * same phases, a card over the scrollback.
 */
type HostLinkForm = 'banner' | 'notice';

type Copy = (host: string) => string;

/** Every string the host link shows. English by default; a product passes its own. */
type HostLinkLabels = {
  /** The status bar's link label, per phase. */
  status: Record<HostLinkPhase, Copy>;
  /** The prompt's placeholder while the phase changes what input does. */
  placeholder: Partial<Record<HostLinkPhase, Copy>>;
  /** The banner's and the card's title. */
  title: Record<'offline' | 'catching-up' | 'reconnected', Copy>;
  /** The banner's dim line. */
  line: Record<'offline' | 'catching-up' | 'reconnected', Copy>;
  /** The card's paragraph. */
  body: Record<'offline' | 'catching-up', Copy>;
  /** The card's mono eyebrow, before the elapsed time. */
  eyebrow: Record<'offline' | 'catching-up', string>;
  /** The banner's toggle. */
  fix: string;
  /** The sentence that opens the fix in the banner's drawer. */
  fixIntro: Copy;
};

const DEFAULT_LABELS: HostLinkLabels = {
  status: {
    live: () => 'Live',
    reconnecting: (h) => `Reconnecting to ${h}…`,
    offline: () => 'Host offline',
    'catching-up': (h) => `Catching up on ${h}…`,
    reconnected: () => 'Reconnected',
  },
  placeholder: {
    reconnecting: () => 'Reconnecting — input sends once live',
    offline: (h) => `Read-only while ${h} is offline`,
    'catching-up': () => 'Catching up — input opens once live',
  },
  title: {
    offline: (h) => `${h} is offline`,
    'catching-up': () => 'Runner is back',
    reconnected: () => 'Reconnected',
  },
  line: {
    offline: () => 'Reconnects on its own when the runner is back',
    'catching-up': (h) => `Catching up on output from ${h}…`,
    reconnected: () => 'Scrollback is up to date',
  },
  body: {
    offline: () =>
      'The runner lost its link to Oppenheimer. Scrollback is kept, and this session reconnects on its own as soon as the runner is back.',
    'catching-up': (h) => `Catching up on output from ${h}. Input opens once the stream is live.`,
  },
  eyebrow: { offline: 'offline', 'catching-up': 'reconnecting' },
  fix: 'How to fix',
  fixIntro: (h) =>
    `Scrollback is kept and input is paused. The session picks up on its own the moment the runner on ${h} reconnects — nothing to press here.`,
};

type PhaseRow = {
  link: TerminalLinkState;
  /** The prompt is disabled. */
  locked: boolean;
  /** The banner form shows its banner instead of the status bar. */
  banner: boolean;
  /** The notice form shows its card, and fades the scrollback this much. */
  card: false | 'soft' | 'strong';
  /** There is a fix to offer (the runner is still away). */
  fix: boolean;
};

/**
 * The contract both forms draw from, as the 2026-10-03 frames have it. The
 * notice form has no Reconnected card: once caught up its card goes and the
 * status bar says Reconnected; the banner says it in its own place.
 */
const PHASES: Record<HostLinkPhase, PhaseRow> = {
  live: { link: 'live', locked: false, banner: false, card: false, fix: false },
  reconnecting: { link: 'reconnecting', locked: false, banner: false, card: false, fix: false },
  offline: { link: 'offline', locked: true, banner: true, card: 'strong', fix: true },
  'catching-up': { link: 'reconnecting', locked: true, banner: true, card: 'soft', fix: false },
  reconnected: { link: 'live', locked: false, banner: true, card: false, fix: false },
};

/** What `Terminal`'s `hostLink` carries. */
type TerminalHostLink = {
  phase: HostLinkPhase;
  /** `banner` unless the product chose the card. */
  form?: HostLinkForm;
  /** The host's name, as the copy says it ("optimus is offline"). */
  host: string;
  labels?: Partial<HostLinkLabels>;
};

type HostLinkState = { phase: HostLinkPhase; form: HostLinkForm; host: string; labels: HostLinkLabels; row: PhaseRow };

const LIVE: HostLinkState = {
  phase: 'live',
  form: 'banner',
  host: '',
  labels: DEFAULT_LABELS,
  row: PHASES.live,
};

const HostLinkContext = React.createContext<HostLinkState>(LIVE);

function resolveHostLink(link: TerminalHostLink | undefined): HostLinkState {
  if (!link) return LIVE;
  return {
    phase: link.phase,
    form: link.form ?? 'banner',
    host: link.host,
    labels: { ...DEFAULT_LABELS, ...link.labels },
    row: PHASES[link.phase],
  };
}

/** The host link a `Terminal` was given, resolved against the phase table; live when none. */
function useHostLink(): HostLinkState {
  return React.useContext(HostLinkContext);
}

/** The 6px link dot: green live, amber pulsing while reconnecting, amber and still offline. */
function LinkDot({ state }: { state: TerminalLinkState }) {
  return (
    <span
      aria-hidden
      data-slot="terminal-link-dot"
      data-link={state}
      className={cn(
        'size-1.5 shrink-0 rounded-pill transition-colors duration-slow ease-standard',
        state === 'live' && 'bg-success',
        state === 'reconnecting' && 'bg-warning motion-safe:animate-pulse-dot',
        state === 'offline' && 'bg-term-warning',
      )}
    />
  );
}

export { HostLinkContext, LinkDot, resolveHostLink, useHostLink };
export type { HostLinkForm, HostLinkLabels, HostLinkPhase, HostLinkState, TerminalHostLink, TerminalLinkState };
