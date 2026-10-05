'use client';

import { Composer, type ComposerAttachment } from '@oppenheimer/design-system-web/composer';
import { CommandRow, CommandRowList } from '@oppenheimer/design-system-web/command-row';
import { DropZone } from '@oppenheimer/design-system-web/drop-zone';
import { HostLinkChrome, type HostLinkForm, type HostLinkPhase } from '@oppenheimer/design-system-web/host-link';
import { Link } from '@oppenheimer/design-system-web/link';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import {
  Terminal,
  TerminalLine,
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

/** The phases in the order a session lives them, as the control names them. */
const PHASES: [HostLinkPhase, string][] = [
  ['live', 'Live'],
  ['reconnecting', 'Reconnecting'],
  ['offline', 'Offline'],
  ['catching-up', 'Back'],
  ['reconnected', 'Reconnected'],
];

const HOST = 'optimus';

function Scrollback() {
  return (
    <TerminalScrollback>
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
 * One terminal through every phase of its link to the host, in one form.
 * The demo only steps the phase: what each phase shows is the design
 * system's phase table.
 */
export function TerminalHostLinkDemo({ form }: { form: HostLinkForm }) {
  const [phase, setPhase] = React.useState<HostLinkPhase>('offline');
  // The host dropped 2m 14s before the page opened, as on the frame.
  const [since] = React.useState(() => Date.now() - 134_000);
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        aria-label="Host link"
        value={phase}
        onValueChange={(value) => {
          const next = PHASES.find(([p]) => p === value);
          if (next) setPhase(next[0]);
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
        <Terminal hostLink={{ phase, form, host: HOST }}>
          <Scrollback />
          <TerminalPrompt />
          <HostLinkChrome
            elapsed={<Elapsed since={since} />}
            fix={<Fix surface={form === 'banner' ? 'terminal' : 'card'} />}
          >
            <TerminalStatusItem>6% used · 4h 2m</TerminalStatusItem>
            <TerminalStatusItem>763.4 MB</TerminalStatusItem>
            <TerminalStatusItem>1 host</TerminalStatusItem>
          </HostLinkChrome>
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
      onFiles={(dropped) =>
        setFiles((f) => [...f, ...dropped.map((file, i) => ({ id: `${Date.now()}-${i}`, name: file.name }))])
      }
      className="h-90 w-full"
    >
      <div className="flex h-full flex-col items-center justify-center gap-6 border border-border-subtle bg-canvas p-6">
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
      onFiles={(dropped) =>
        setDraft((d) => [d, ...dropped.map((file) => `@${file.name}`)].filter(Boolean).join(' '))
      }
      className="h-90 w-full"
    >
      <div className="h-full overflow-hidden border border-term-border">
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
