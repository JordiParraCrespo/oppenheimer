'use client';

import { Composer, type ComposerAttachment } from '@oppenheimer/design-system-web/composer';
import { CommandRow, CommandRowList } from '@oppenheimer/design-system-web/command-row';
import { DropZone } from '@oppenheimer/design-system-web/drop-zone';
import { Link } from '@oppenheimer/design-system-web/link';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import {
  Terminal,
  TerminalBanner,
  TerminalBannerToggle,
  TerminalDrawer,
  TerminalDrawerText,
  type TerminalLinkState,
  TerminalLine,
  TerminalNotice,
  TerminalPrompt,
  TerminalScrollback,
  TerminalSpacer,
  TerminalStatusBar,
  TerminalStatusItem,
  TerminalStatusLink,
  TerminalTurn,
} from '@oppenheimer/design-system-web/terminal';
import { useNow } from '@oppenheimer/design-system-web/hooks/use-now';
import * as React from 'react';

/**
 * The host link's phases, in the order a session lives them: live, a blip
 * the console rides out, the host gone, the runner back and the scrollback
 * catching up, then a quiet "Reconnected" before the bar returns.
 */
type Phase = 'live' | 'blip' | 'offline' | 'resync' | 'restored';

const PHASES: [Phase, string][] = [
  ['live', 'Live'],
  ['blip', 'Reconnecting'],
  ['offline', 'Offline'],
  ['resync', 'Back'],
  ['restored', 'Reconnected'],
];

const HOST = 'optimus';

function linkOf(phase: Phase): TerminalLinkState {
  if (phase === 'offline') return 'offline';
  if (phase === 'blip' || phase === 'resync') return 'reconnecting';
  return 'live';
}

function Scrollback({ fade }: { fade?: 'soft' | 'strong' }) {
  return (
    <TerminalScrollback fade={fade}>
      <TerminalLine command>gh auth login --web</TerminalLine>
      <TerminalLine tone="dim">Opening github.com/login/device …</TerminalLine>
      <TerminalSpacer />
      <TerminalTurn>
        <TerminalLine tone="strong">
          The SSH key authenticates git operations, which is why the port and push already worked.
        </TerminalLine>
        <TerminalLine tone="dim">{'  1. gh auth login → web browser flow. One-time setup.'}</TerminalLine>
        <TerminalLine tone="dim">{'  2. Just click the link. The branch is already on the remote.'}</TerminalLine>
      </TerminalTurn>
      <TerminalLine tone="success">✓ Authorized as jordiparra</TerminalLine>
      <TerminalLine tone="warning">! branch already pushed — only the PR remains</TerminalLine>
    </TerminalScrollback>
  );
}

function placeholderOf(phase: Phase) {
  if (phase === 'offline') return `Read-only while ${HOST} is offline`;
  if (phase === 'resync') return 'Catching up — input opens once live';
  if (phase === 'blip') return 'Reconnecting — input sends once live';
  return 'Ask the agent, or run a command';
}

function labelOf(phase: Phase) {
  if (phase === 'offline') return 'Host offline';
  if (phase === 'blip') return `Reconnecting to ${HOST}…`;
  if (phase === 'resync') return `Catching up on ${HOST}…`;
  if (phase === 'restored') return 'Reconnected';
  return 'Live';
}

/**
 * The commands that bring a host's runner back, as the frames word them:
 * `[lead, command]`, the host's name filled in. One marked list, so a
 * project that prunes the runner keeps a showcase that compiles.
 */
export function fixCommands(host: string): [string, string][] {
  return [
    // oppenheimer:begin runner
    [`If it stays offline, reinstall and start the runner on ${host}:`, 'oppenheimer-runner install'],
    ['To see what went wrong:', 'oppenheimer-runner status'],
    // oppenheimer:end runner
  ];
}

/** The fix, on either surface. */
function Fix({ surface }: { surface: 'card' | 'terminal' }) {
  return (
    <>
      <CommandRowList>
        {fixCommands(HOST).map(([lead, command]) => (
          <CommandRow key={command} surface={surface} lead={lead} command={command} />
        ))}
      </CommandRowList>
      <div className="mt-1">
        <Link href="#hostcard">Settings → Hosts</Link>
      </div>
    </>
  );
}

/** "2m 14s" since the host went away; a leaf of its own, so the tick redraws one line. */
function Elapsed({ since }: { since: number }) {
  const now = useNow(1000);
  const secs = Math.max(0, Math.floor((now - since) / 1000));
  // The page is prerendered, so the server's second and the browser's differ.
  return (
    <span suppressHydrationWarning>
      {secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`}
    </span>
  );
}

/**
 * One terminal, every phase of its link to the host, in the form `form`
 * names: the banner (with its drawer) in place of the status bar, or the
 * notice card over the faded scrollback.
 */
export function TerminalHostLinkDemo({ form, initial = 'offline' }: { form: 'banner' | 'notice'; initial?: Phase }) {
  const [phase, setPhase] = React.useState<Phase>(initial);
  const [fixOpen, setFixOpen] = React.useState(false);
  // The host dropped 2m 14s before the page opened, as on the frame.
  const [since] = React.useState(() => Date.now() - 134_000);

  const away = phase === 'offline' || phase === 'resync' || phase === 'restored';
  const banner = form === 'banner' && away;
  const notice = form === 'notice' && (phase === 'offline' || phase === 'resync');
  const locked = phase === 'offline' || phase === 'resync';

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        aria-label="Host link"
        value={phase}
        onValueChange={(value) => {
          setPhase(value as Phase);
          setFixOpen(false);
        }}
        className="self-start"
      >
        {PHASES.map(([value, label]) => (
          <SegmentedControlItem key={value} value={value}>
            {label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <div className={`${form === 'notice' ? 'h-140' : 'h-105'} w-full overflow-hidden rounded-lg border border-term-border`}>
        <Terminal>
          <Scrollback fade={notice ? (phase === 'offline' ? 'strong' : 'soft') : undefined} />
          <TerminalPrompt placeholder={placeholderOf(phase)} disabled={locked} />
          {banner ? (
            <TerminalBanner
              state={linkOf(phase)}
              title={phase === 'offline' ? `${HOST} is offline` : phase === 'resync' ? 'Runner is back' : 'Reconnected'}
              description={
                phase === 'offline'
                  ? 'Reconnects on its own when the runner is back'
                  : phase === 'resync'
                    ? `Catching up on output from ${HOST}…`
                    : 'Scrollback is up to date'
              }
              elapsed={phase === 'offline' ? <Elapsed since={since} /> : undefined}
              action={
                phase === 'offline' ? (
                  <TerminalBannerToggle open={fixOpen} onClick={() => setFixOpen((v) => !v)}>
                    How to fix
                  </TerminalBannerToggle>
                ) : undefined
              }
            />
          ) : (
            <TerminalStatusBar>
              <TerminalStatusLink state={linkOf(phase)}>{labelOf(phase)}</TerminalStatusLink>
              <TerminalStatusItem>6% used · 4h 2m</TerminalStatusItem>
              <TerminalStatusItem>763.4 MB</TerminalStatusItem>
              <TerminalStatusItem>1 host</TerminalStatusItem>
            </TerminalStatusBar>
          )}
          {banner && phase === 'offline' && fixOpen ? (
            <TerminalDrawer>
              <TerminalDrawerText>
                Scrollback is kept and input is paused. The session picks up on its own the moment the runner on{' '}
                {HOST} reconnects — nothing to press here.
              </TerminalDrawerText>
              <Fix surface="terminal" />
            </TerminalDrawer>
          ) : null}
          {notice ? (
            <TerminalNotice
              state={linkOf(phase)}
              eyebrow={phase === 'offline' ? <>offline · <Elapsed since={since} /></> : 'reconnecting'}
              title={phase === 'offline' ? `${HOST} is offline` : 'Runner is back'}
              description={
                phase === 'offline'
                  ? 'The runner lost its link to Oppenheimer. Scrollback is kept, and this session reconnects on its own as soon as the runner is back.'
                  : `Catching up on output from ${HOST}. Input opens once the stream is live.`
              }
            >
              {phase === 'offline' ? <Fix surface="card" /> : null}
            </TerminalNotice>
          ) : null}
        </Terminal>
      </div>
    </div>
  );
}

/**
 * New session as a drop target: a file dragged anywhere over the pane joins
 * the composer's attachments.
 */
export function DropZoneNewSessionDemo() {
  const [value, setValue] = React.useState('');
  const [files, setFiles] = React.useState<ComposerAttachment[]>([]);
  return (
    <DropZone
      listen="self"
      onFiles={(dropped) =>
        setFiles((f) => [...f, ...dropped.map((file, i) => ({ id: `${Date.now()}-${i}`, name: file.name }))])
      }
      className="h-90 w-full"
    >
      <div className="flex h-full flex-col items-center justify-center gap-6 rounded-lg border border-border-subtle bg-canvas p-6">
      <h3 className="m-0 text-center font-display text-h2 font-semibold text-balance text-fg">Ready when you are.</h3>
      <div className="w-full max-w-160">
        <Composer
          value={value}
          onValueChange={setValue}
          onSubmit={() => setValue('')}
          attachments={files}
          onRemoveAttachment={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
          onAttach={() => {}}
        />
      </div>
      </div>
    </DropZone>
  );
}

/**
 * A running session as a drop target: each dropped file goes into the
 * prompt as an `@path` the agent can read.
 */
export function DropZoneTerminalDemo() {
  const [draft, setDraft] = React.useState('');
  return (
    <DropZone
      listen="self"
      onFiles={(dropped) =>
        setDraft((d) => [d, ...dropped.map((file) => `@${file.name}`)].filter(Boolean).join(' '))
      }
      className="h-90 w-full"
    >
      <div className="h-full overflow-hidden rounded-lg border border-term-border">
      <Terminal>
        <Scrollback />
        <TerminalPrompt value={draft} onChange={(event) => setDraft(event.target.value)} />
        <TerminalStatusBar>
          <TerminalStatusLink state="live">Live</TerminalStatusLink>
          <TerminalStatusItem>1 host</TerminalStatusItem>
        </TerminalStatusBar>
      </Terminal>
      </div>
    </DropZone>
  );
}
