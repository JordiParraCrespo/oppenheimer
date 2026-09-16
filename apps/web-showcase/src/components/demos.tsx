'use client';

import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Button } from '@oppenheimer/design-system-web/button';
import {
  ChipSelect,
  ChipSelectAction,
  ChipSelectOption,
} from '@oppenheimer/design-system-web/chip-select';
import { Composer } from '@oppenheimer/design-system-web/composer';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@oppenheimer/design-system-web/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
} from '@oppenheimer/design-system-web/dropdown-menu';
import { EmptyState } from '@oppenheimer/design-system-web/empty-state';
import { FilterChip } from '@oppenheimer/design-system-web/chip';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import { ImageCarousel } from '@oppenheimer/design-system-web/image-carousel';
import { SessionItem, SessionList } from '@oppenheimer/design-system-web/session-item';
import { Stepper } from '@oppenheimer/design-system-web/stepper';
import {
  Terminal,
  TerminalLine,
  TerminalPrompt,
  TerminalScrollback,
  TerminalSpacer,
  TerminalStatusBar,
  TerminalStatusItem,
  TerminalTurn,
} from '@oppenheimer/design-system-web/terminal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oppenheimer/design-system-web/tooltip';
import { Wordmark } from '@oppenheimer/design-system-web/wordmark';
import {
  BotIcon,
  ChevronsUpDownIcon,
  CpuIcon,
  FolderIcon,
  GitBranchIcon,
  GlobeIcon,
  LogOutIcon,
  MoonIcon,
  Settings2Icon,
  TerminalIcon,
} from 'lucide-react';
import * as React from 'react';

/* ── Dialog ──────────────────────────────────────────────────────────────── */

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" />}>Open the welcome modal</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You're set up</DialogTitle>
          <DialogDescription>Three things worth knowing before your first session.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 text-fg-muted">
          <p className="flex gap-3">
            <CpuIcon className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <span>
              Sessions run on <span className="text-fg">your own hosts</span>, in a git worktree per
              session. Nothing executes in our cloud unless you pick a cloud VM.
            </span>
          </p>
          <p className="flex gap-3">
            <TerminalIcon className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <span>
              Every step is <span className="text-fg">visible and interruptible</span>: read the
              output live, send an instruction mid-run, stop it at any point.
            </span>
          </p>
          <p className="flex gap-3">
            <GitBranchIcon className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <span>
              Scope comes first: <span className="text-fg">host, repository, branch, agent</span>.
              Change any of them per session from the chips.
            </span>
          </p>
        </DialogBody>
        <DialogFooter>
          <Button size="lg" block>
            Start your first session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DestructiveDialogDemo() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" />}>Stop run…</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Stop this run?</DialogTitle>
          <DialogDescription>
            Two steps are mid-flight. Completed work is kept; in-flight tool calls are cancelled.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Keep running</Button>
          <Button variant="destructive">Stop run</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Menus ───────────────────────────────────────────────────────────────── */

export function FilterMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<IconButton aria-label="Filter sessions" size="xs" />}>
        <Settings2Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[230px]">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Repository <DropdownMenuValue>All repositories</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="all">
              <DropdownMenuRadioItem value="all">All repositories</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="xrp">xrp-mobile</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="orch">orchestrator</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Agent <DropdownMenuValue>All agents</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="all">
              <DropdownMenuRadioItem value="all">All agents</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="claude">Claude Code</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="shell">Plain shell</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Host <DropdownMenuValue>All hosts</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="all">
              <DropdownMenuRadioItem value="all">All hosts</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="mac">mac-studio</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Sort by <DropdownMenuValue>Last activity</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="activity">
              <DropdownMenuRadioItem value="activity">Last activity</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created">Created</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Clear filters</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-11 w-60 items-center gap-2.5 rounded-sm px-2 text-left text-fg outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring"
          />
        }
      >
        <Avatar size="sm" variant="accent">
          <AvatarFallback>JP</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-operate">Jordi Parra</span>
        <ChevronsUpDownIcon className="size-3.5 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="min-w-[250px]">
        <DropdownMenuHeader>jordiparra99@gmail.com</DropdownMenuHeader>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoonIcon /> Appearance <DropdownMenuValue>Match system</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="system">
              <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GlobeIcon /> Language <DropdownMenuValue>English</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="en">
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="es">Español</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MODELS = [
  ['opus', 'Claude Opus 4.6', 'Deepest reasoning, long-horizon work'],
  ['sonnet', 'Claude Sonnet 4.6', 'Most efficient for everyday tasks'],
  ['haiku', 'Claude Haiku 4.5', 'Fastest for quick answers'],
] as const;

export function ModelMenu() {
  const [model, setModel] = React.useState<string>('sonnet');
  const [effort, setEffort] = React.useState<string>('Medium');
  const name = MODELS.find((m) => m[0] === model)?.[1];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-[30px] items-center gap-2 rounded-sm px-2.5 text-sm whitespace-nowrap text-fg outline-none transition-colors duration-fast hover:bg-hover-surface aria-expanded:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring"
          />
        }
      >
        {name} <span className="text-fg-muted">{effort}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-[290px]">
        <DropdownMenuLabel>Claude Code</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={model} onValueChange={(v) => setModel(String(v))}>
          {MODELS.map(([id, label, desc]) => (
            <DropdownMenuRadioItem key={id} value={id} description={desc}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Effort <DropdownMenuValue>{effort}</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={effort} onValueChange={(v) => setEffort(String(v))}>
              {['Low', 'Medium', 'High'].map((e) => (
                <DropdownMenuRadioItem key={e} value={e}>
                  {e}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

export function TooltipDemo() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<IconButton aria-label="Filter sessions" />}>
            <Settings2Icon />
          </TooltipTrigger>
          <TooltipContent>Filter sessions</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<IconButton aria-label="New session" variant="solid" />}>
            <TerminalIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">New session</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* ── ChipSelect ──────────────────────────────────────────────────────────── */

export function ScopeChips() {
  const [host, setHost] = React.useState<string | null>('mac-studio');
  const [repo, setRepo] = React.useState<string | null>('xrp-mobile');
  const [branch, setBranch] = React.useState<string | null>('main');
  const [agent, setAgent] = React.useState<string | null>('claude');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipSelect value={host} onValueChange={setHost} icon={<CpuIcon />} aria-label="Host">
        <ChipSelectOption value="mac-studio" description="macOS 15 · echo 38 ms">
          mac-studio
        </ChipSelectOption>
        <ChipSelectOption value="optimus" description="Ubuntu 24.04 · echo 112 ms">
          optimus
        </ChipSelectOption>
        <ChipSelectAction description="Install the runner on another machine">Add a host…</ChipSelectAction>
      </ChipSelect>
      <ChipSelect value={repo} onValueChange={setRepo} icon={<FolderIcon />} aria-label="Repository">
        <ChipSelectOption value="xrp-mobile" description="JordiParraCrespo">
          xrp-mobile
        </ChipSelectOption>
        <ChipSelectOption value="orchestrator" description="JordiParraCrespo">
          orchestrator
        </ChipSelectOption>
        <ChipSelectOption value="oppenheimer" description="JordiParraCrespo">
          oppenheimer
        </ChipSelectOption>
      </ChipSelect>
      <ChipSelect value={branch} onValueChange={setBranch} icon={<GitBranchIcon />} aria-label="Branch">
        <ChipSelectOption value="main">main</ChipSelectOption>
        <ChipSelectOption value="release/1.4">release/1.4</ChipSelectOption>
      </ChipSelect>
      <ChipSelect value={agent} onValueChange={setAgent} icon={<BotIcon />} aria-label="Agent">
        <ChipSelectOption
          value="claude"
          description={
            <>
              Runs <span className="figures text-[11.5px]">claude</span> on the host
            </>
          }
        >
          Claude Code
        </ChipSelectOption>
        <ChipSelectOption value="shell" description="No agent, just a terminal">
          Plain shell
        </ChipSelectOption>
      </ChipSelect>
    </div>
  );
}

/* ── Composer ────────────────────────────────────────────────────────────── */

export function ComposerDemo({ full }: { full?: boolean }) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [files, setFiles] = React.useState<{ id: string; name: string }[]>(
    full ? [{ id: '1', name: 'api-config.md' }] : [],
  );
  const [recording, setRecording] = React.useState(false);
  return (
    <div className="w-full max-w-[720px]">
      <Composer
        value={value}
        onValueChange={setValue}
        placeholder={full ? 'Describe a task or ask a question' : 'Name or first task'}
        busy={busy}
        onSubmit={() => {
          setBusy(true);
          setTimeout(() => {
            setBusy(false);
            setValue('');
          }, 1600);
        }}
        onStop={() => setBusy(false)}
        attachments={files}
        onRemoveAttachment={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
        onAttach={full ? () => setFiles((f) => [...f, { id: String(Date.now()), name: 'notes.txt' }]) : undefined}
        onRecord={full ? () => setRecording((r) => !r) : undefined}
        recording={recording}
        tools={full ? <ModelMenu /> : undefined}
      />
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

const SESSIONS: [string, string, 'running' | 'needs-input' | 'failed' | 'idle'][] = [
  ['PR #121 porting to peersyst', '2m', 'running'],
  ['nightly ingest', '14m', 'running'],
  ['invoice triage', '1h', 'needs-input'],
  ['XRP Mobile API cleanup', '3h', 'needs-input'],
  ['retriever eval', '5h', 'failed'],
  ['First version page design', '1d', 'idle'],
  ['doc summariser', '2d', 'idle'],
];

export function SidebarDemo({ empty }: { empty?: boolean }) {
  const [active, setActive] = React.useState(0);
  const [filters, setFilters] = React.useState<string[]>(empty ? [] : ['Running only']);
  return (
    <div className="flex h-[560px] w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center px-4">
        <Wordmark product="Console" />
      </div>
      <div className="px-3">
        <Button variant={empty ? 'secondary' : 'primary'} size="md" block>
          New session
        </Button>
      </div>
      <div className="mt-4 flex h-[26px] items-center gap-2 px-5">
        <span className="eyebrow">Sessions</span>
        <span className="figures ml-auto text-[11px] text-sidebar-muted">{empty ? 0 : SESSIONS.length}</span>
        <FilterMenuDemo />
      </div>
      {filters.length ? (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {filters.map((f) => (
            <FilterChip key={f} onRemove={() => setFilters((x) => x.filter((y) => y !== f))}>
              {f}
            </FilterChip>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {empty ? (
          <EmptyState compact>
            <EmptyState.Header>
              <EmptyState.Description>
                No sessions yet. The one you start appears here with its live state.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <SessionList>
            {SESSIONS.map(([name, age, state], i) => (
              <SessionItem
                key={name}
                name={name}
                age={age}
                state={state}
                active={i === active}
                onClick={() => setActive(i)}
              />
            ))}
          </SessionList>
        )}
      </div>
      <div className="border-t border-sidebar-border px-2 py-2">
        <AccountMenuDemo />
      </div>
    </div>
  );
}

/* ── Stepper ─────────────────────────────────────────────────────────────── */

const BOOT = [
  ['host', 'Reaching mac-studio'],
  ['clone', 'Cloning xrp-mobile'],
  ['branch', 'Checking out main'],
  ['agent', 'Starting Claude Code'],
] as const;

export function StepperDemo() {
  const [step, setStep] = React.useState(1);
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => {
      setT((x) => x + 1);
      setStep((s) => (s >= BOOT.length + 1 ? 0 : s + (Math.random() > 0.55 ? 1 : 0)));
    }, 900);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return (
    <div className="w-full max-w-[420px]">
      <div className="eyebrow figures">Starting your session</div>
      <h3 className="mt-2 text-h2 font-semibold">PR #121 porting to peersyst</h3>
      <p className="mt-1.5 text-operate text-fg-muted">A worktree is being prepared on mac-studio.</p>
      <Stepper
        className="mt-6"
        steps={BOOT.map(([id, label], i) => ({
          id,
          label,
          meta: i < step ? `${(0.6 + i * 0.7).toFixed(1)}s` : i === step ? 'running' : undefined,
          state: i < step ? 'done' : i === step ? 'running' : 'pending',
        }))}
        elapsed={`${mm}:${ss}`}
        status={step >= BOOT.length ? 'Handing off to the terminal' : 'Provisioning'}
      />
    </div>
  );
}

/* ── Terminal ────────────────────────────────────────────────────────────── */

export function TerminalDemo() {
  return (
    <div className="h-[520px] w-full overflow-hidden rounded-lg border border-term-border">
      <Terminal>
        <TerminalScrollback>
          <TerminalLine command>gh auth login --web</TerminalLine>
          <TerminalLine tone="dim">Opening github.com/login/device …</TerminalLine>
          <TerminalSpacer />
          <TerminalTurn>
            <TerminalLine tone="strong">
              The SSH key authenticates git operations, which is why the port and push already
              worked. Opening a PR goes through the REST API, which needs a token.
            </TerminalLine>
            <TerminalSpacer />
            <TerminalLine>Three ways forward, and the last one needs no token at all:</TerminalLine>
            <TerminalLine tone="dim">{'  1. gh auth login → web browser flow. One-time setup.'}</TerminalLine>
            <TerminalLine tone="dim">{'  2. Manual PAT — more steps, same result.'}</TerminalLine>
            <TerminalLine tone="dim">{'  3. Just click the link. The branch is already on the remote.'}</TerminalLine>
          </TerminalTurn>
          <TerminalLine tone="accent">
            https://github.com/peersyst/xrp-mobile/pull/new/port/121-api-config-hardening
          </TerminalLine>
          <TerminalSpacer />
          <TerminalLine>{'  code: 5192-177E'}</TerminalLine>
          <TerminalLine>{'  expires in ~15 minutes'}</TerminalLine>
          <TerminalSpacer />
          <TerminalLine tone="success">✓ Authorized as jordiparra</TerminalLine>
          <TerminalLine tone="warning">! branch already pushed — only the PR remains</TerminalLine>
          <TerminalLine tone="danger">× dbus: failed to launch browser locally (headless host)</TerminalLine>
          <TerminalSpacer />
          <TerminalLine tone="dim">Baked for 13s</TerminalLine>
        </TerminalScrollback>
        <TerminalPrompt />
        <TerminalStatusBar>
          <TerminalStatusItem>6% used · 4h 2m</TerminalStatusItem>
          <TerminalStatusItem>51% used · 4d 3h</TerminalStatusItem>
          <TerminalStatusItem>763.4 MB</TerminalStatusItem>
          <TerminalStatusItem>bypass permissions on</TerminalStatusItem>
          <TerminalStatusItem>1 host</TerminalStatusItem>
        </TerminalStatusBar>
      </Terminal>
    </div>
  );
}

/* ── Carousel ────────────────────────────────────────────────────────────── */

const SLIDES = [
  ['oppenheimer-portrait', 'J. Robert Oppenheimer', 'J. Robert Oppenheimer, 1946.', '50% 22%'],
  ['oppenheimer-einstein', 'Oppenheimer with Albert Einstein', 'With Albert Einstein at the Institute for Advanced Study.', '50% 30%'],
  ['calutron-operators', 'Calutron operators at Oak Ridge', 'Calutron operators, Oak Ridge, 1944.', '50% 50%'],
  ['oppenheimer-groves', 'Oppenheimer with General Leslie Groves', 'With General Groves at the Trinity site.', '50% 40%'],
  ['los-alamos-gate', 'Los Alamos Project main gate', 'Los Alamos Project main gate.', '50% 50%'],
] as const;

export function CarouselDemo() {
  return (
    <div className="h-[460px] w-full max-w-[420px]">
      <ImageCarousel
        slides={SLIDES.map(([file, alt, caption, position]) => ({
          src: `/imagery/${file}.webp`,
          alt,
          caption,
          position,
        }))}
      />
    </div>
  );
}
