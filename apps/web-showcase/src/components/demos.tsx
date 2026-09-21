'use client';

import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Button } from '@oppenheimer/design-system-web/button';
import {
  AgentModelSelect,
  type AgentOption,
  type Engine,
} from '@oppenheimer/design-system-web/agent-model-select';
import { EffortPicker, EffortSlider } from '@oppenheimer/design-system-web/effort-slider';
import {
  PermissionMenu,
  type PermissionLevel,
} from '@oppenheimer/design-system-web/permission-menu';
import { ChipSelect, type ChipSelectOption } from '@oppenheimer/design-system-web/chip-select';
import { CodeBlock } from '@oppenheimer/design-system-web/code-block';
import { Field, FieldDescription, FieldLabel } from '@oppenheimer/design-system-web/field';
import { Link } from '@oppenheimer/design-system-web/link';
import {
  RepositorySelect,
  type RepositoryOption,
  type RepositoryScope,
} from '@oppenheimer/design-system-web/repository-select';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web/segmented-control';
import { SlugInput, type SlugStatus } from '@oppenheimer/design-system-web/slug-input';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';
import { Composer } from '@oppenheimer/design-system-web/composer';
import {
  Dialog,
  DialogBody,
  DialogClose,
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
  ChevronsUpDownIcon,
  CpuIcon,
  GitBranchIcon,
  GlobeIcon,
  LogOutIcon,
  MoonIcon,
  Settings2Icon,
  TerminalIcon,
} from 'lucide-react';
import * as React from 'react';

/* ── Dialog ──────────────────────────────────────────────────────────────── */

const INSTALL = 'curl -fsSL https://app.oppenheimer.dev/install.sh \\\n  | sh -s -- --token opk_7f3a9c';
const PROMPT =
  'Install the oppenheimer runner here, then run\noppenheimer-runner status and report the hostname.\ncurl -fsSL https://app.oppenheimer.dev/install.sh | sh -s -- --token opk_7f3a9c';

/**
 * The one dialog in v1. One instruction, two ways to read it, and a status
 * line that resolves in place so nothing below it moves.
 */
export function AddHostDialogDemo() {
  const [tab, setTab] = React.useState('cmd');
  const [registered, setRegistered] = React.useState(false);
  return (
    <Dialog onOpenChange={(open) => !open && setRegistered(false)}>
      <DialogTrigger render={<Button variant="secondary" />}>Add a host…</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a host</DialogTitle>
          <DialogDescription>
            A server you control — a cloud VM, a build box, or your own workstation.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex-1 text-sm font-medium text-fg">Run this on it, once</span>
              <SegmentedControl value={tab} onValueChange={setTab} aria-label="Format">
                <SegmentedControlItem value="cmd">Command</SegmentedControlItem>
                <SegmentedControlItem value="prompt">Agent prompt</SegmentedControlItem>
              </SegmentedControl>
            </div>
            <CodeBlock layout="panel" code={tab === 'cmd' ? INSTALL : PROMPT} />
            <div className="flex items-baseline justify-between gap-3">
              <span className="figures text-[11.5px] whitespace-nowrap text-fg-subtle">
                Token expires in 59:41 · single use
              </span>
              <Link href="#dialog" className="text-[11.5px] whitespace-nowrap">
                New token
              </Link>
            </div>
          </div>
          <div className="h-px bg-border-subtle" />
          <div className="flex min-h-[52px] items-center">
            {registered ? (
              <div className="flex w-full flex-wrap items-center gap-2.5">
                <StatusDot state="running" className="items-center">
                  <span className="figures text-[13px]">mac-studio</span>
                </StatusDot>
                <span className="text-xs text-fg-muted">macOS 15 · echo 38 ms</span>
                <span className="flex-1" />
                <span className="text-xs text-fg-muted">git, tmux, claude ready</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRegistered(true)}
                className="text-left"
                title="Click to simulate the host registering"
              >
                <StatusDot state="pending" pulse>
                  Listening for this host…
                </StatusDot>
              </button>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <Button disabled={!registered}>Use this host</Button>
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
      <DropdownMenuTrigger render={<IconButton aria-label="Filter sessions" size="xs" variant="quiet" />}>
        <Settings2Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-57.5">
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
      <DropdownMenuContent side="top" className="min-w-62.5">
        <DropdownMenuHeader>jordiparra99@gmail.com</DropdownMenuHeader>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoonIcon /> Appearance <DropdownMenuValue>Match system</DropdownMenuValue>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="system">
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
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


/* ── Engine: agent + model, effort, permissions ───────────────────────── */

export const HARNESSES: AgentOption[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    models: [
      { value: 'opus', label: 'Claude Opus 4.6' },
      { value: 'sonnet', label: 'Claude Sonnet 4.6' },
      { value: 'haiku', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    models: [
      { value: 'gpt', label: 'GPT-5.2' },
      { value: 'gpt-codex', label: 'GPT-5.2 Codex' },
      { value: 'gpt-mini', label: 'GPT-5.2 mini' },
    ],
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    models: [
      { value: 'qwen', label: 'Qwen3 Coder 480B' },
      { value: 'deepseek', label: 'DeepSeek V3.2' },
      { value: 'kimi', label: 'Kimi K2' },
      { value: 'llama', label: 'Llama 4 Maverick' },
      { value: 'glm', label: 'GLM 4.6' },
    ],
  },
  { id: 'shell', label: 'Blank terminal', models: [] },
];

export const PERMISSIONS = [
  {
    value: 'ask' as const,
    label: 'Ask for approval',
    description: 'Always ask before editing files or reaching the internet.',
  },
  {
    value: 'auto' as const,
    label: 'Approve for me',
    description: 'Only ask for actions detected as potentially unsafe.',
  },
  {
    value: 'full' as const,
    label: 'Full access',
    description: 'Unrestricted access to the internet and any file on the host.',
  },
];

export function AgentModelDemo() {
  const [engine, setEngine] = React.useState<Engine>({ agent: 'claude-code', model: 'sonnet' });
  return <AgentModelSelect agents={HARNESSES} value={engine} onValueChange={setEngine} />;
}

export function EffortDemo({ bare }: { bare?: boolean }) {
  const [effort, setEffort] = React.useState('medium');
  if (bare) {
    return (
      <div className="w-[240px]">
        <EffortSlider value={effort} onValueChange={setEffort} />
      </div>
    );
  }
  return <EffortPicker value={effort} onValueChange={setEffort} />;
}

export function PermissionDemo({ initial = 'auto' }: { initial?: PermissionLevel }) {
  const [level, setLevel] = React.useState<PermissionLevel>(initial);
  return <PermissionMenu options={PERMISSIONS} value={level} onValueChange={setLevel} />;
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

const HOSTS: ChipSelectOption[] = [
  { value: 'optimus', label: 'optimus', description: '32 vCPU · eu-west · idle' },
  { value: 'mac-studio', label: 'jordis-mac-studio', description: 'local · 2 sessions running' },
  { value: 'fable', label: 'fable', description: '16 vCPU · us-east · idle' },
];

const BRANCHES = (extra: string[]) => [
  { value: 'main' },
  ...extra.map((value) => ({ value })),
];

export const REPOS: RepositoryOption[] = [
  {
    id: 'xrp-mobile',
    name: 'xrp-mobile',
    description: 'updated 3h ago',
    keywords: 'JordiParraCrespo',
    branches: BRANCHES([
      'port/121-api-config-hardening',
      'feat/auth-key-hashing',
      'changeset-release/main',
      'claude/amazing-clarke-p631o4',
      'claude/festive-goldberg-uvpii6',
      'release/1.4',
    ]),
  },
  {
    id: 'atlas',
    name: 'atlas',
    description: 'updated 1d ago',
    keywords: 'JordiParraCrespo',
    branches: BRANCHES(['eval/rerank-v3', 'ops/invoices']),
  },
  {
    id: 'flama-ai',
    name: 'flama-ai',
    description: 'updated 3d ago',
    keywords: 'JordiParraCrespo',
    branches: BRANCHES(['design-system']),
  },
  {
    id: 'adri-rodriguez',
    name: 'adri-rodriguez',
    description: 'updated last wk.',
    keywords: 'JordiParraCrespo',
    branches: BRANCHES(['feat/leads-spam-column']),
  },
];

/**
 * The scope row on New session. Every picker filters; the repository one
 * multi-selects with a branch pane per repo, and the branch chip only shows
 * while exactly one repository is selected.
 */
export function ScopeChips() {
  const [host, setHost] = React.useState<string | null>('optimus');
  const [scope, setScope] = React.useState<RepositoryScope[]>([{ id: 'xrp-mobile', branch: 'main' }]);
  const single = scope.length === 1 ? scope[0] : undefined;
  const singleRepo = single ? REPOS.find((r) => r.id === single.id) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipSelect
        value={host}
        onValueChange={setHost}
        options={HOSTS}
        icon={<CpuIcon />}
        aria-label="Host"
        searchPlaceholder="Search hosts…"
        emptyText="No host matches."
        action={{ label: 'Add host…', onSelect: () => {} }}
      />
      <RepositorySelect
        repositories={REPOS}
        value={scope}
        onValueChange={setScope}
        action={{ label: 'Add repository…', onSelect: () => {} }}
      />
      {single && singleRepo ? (
        <ChipSelect
          value={single.branch}
          onValueChange={(branch) => setScope([{ id: single.id, branch }])}
          options={singleRepo.branches.map((b) => ({ value: b.value, label: b.value, mono: true }))}
          icon={<GitBranchIcon />}
          aria-label="Branch"
          searchPlaceholder="Search branches…"
          emptyText="No branch matches."
        />
      ) : null}
    </div>
  );
}

/* ── SlugInput ───────────────────────────────────────────────────────────── */

const TAKEN = ['acme', 'test', 'admin', 'oppenheimer', 'console', 'app'];

/** Type an address: "acme" is taken, anything else is available after a beat. */
export function SlugFieldDemo() {
  const [slug, setSlug] = React.useState('versio');
  const [status, setStatus] = React.useState<SlugStatus>('ok');
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  function onChange(next: string) {
    const clean = next.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 32);
    setSlug(clean);
    clearTimeout(timer.current);
    if (!clean) return setStatus('idle');
    setStatus('checking');
    timer.current = setTimeout(() => setStatus(TAKEN.includes(clean) ? 'taken' : 'ok'), 550);
  }
  return (
    <Field className="w-full max-w-[400px]" data-invalid={status === 'taken' || undefined}>
      <FieldLabel htmlFor="ws-slug">Workspace URL</FieldLabel>
      <SlugInput
        id="ws-slug"
        size="lg"
        prefix="oppenheimer.dev/"
        placeholder="versio"
        value={slug}
        status={status}
        onChange={(e) => onChange(e.target.value)}
      />
      {status === 'ok' ? (
        <FieldDescription tone="success">oppenheimer.dev/{slug} is available.</FieldDescription>
      ) : status === 'taken' ? (
        <FieldDescription tone="danger">oppenheimer.dev/{slug} is taken. Try another address.</FieldDescription>
      ) : status === 'checking' ? (
        <FieldDescription>Checking availability…</FieldDescription>
      ) : (
        <FieldDescription>Letters, numbers and hyphens. This is the address your team signs in at.</FieldDescription>
      )}
    </Field>
  );
}

/* ── SegmentedControl ────────────────────────────────────────────────────── */

export function SegmentedDemo() {
  const [value, setValue] = React.useState('cmd');
  return (
    <SegmentedControl value={value} onValueChange={setValue} aria-label="Format">
      <SegmentedControlItem value="cmd">Command</SegmentedControlItem>
      <SegmentedControlItem value="prompt">Agent prompt</SegmentedControlItem>
    </SegmentedControl>
  );
}

/* ── Composer ────────────────────────────────────────────────────────────── */

export function ComposerDemo({ full }: { full?: boolean }) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [files, setFiles] = React.useState<{ id: string; name: string }[]>(
    full ? [{ id: '1', name: 'Screenshot from 2026-09-20 11-42-07.png' }] : [],
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
        tools={full ? <PermissionDemo /> : undefined}
        engine={
          full ? (
            <>
              <AgentModelDemo />
              <EffortDemo />
            </>
          ) : undefined
        }
      />
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

const SESSIONS: [string, string, 'running' | 'needs-input' | 'failed' | 'idle' | 'pending'][] = [
  ['xrp-mobile +1 · main', '', 'pending'],
  ['PR #121 porting to peersyst', '2m', 'running'],
  ['nightly ingest', '14m', 'running'],
  ['invoice triage', '1h', 'needs-input'],
  ['XRP Mobile API cleanup', '3h', 'needs-input'],
  ['retriever eval', '5h', 'failed'],
  ['First version page design', '1d', 'idle'],
  ['doc summariser', '2d', 'idle'],
];

export function SidebarDemo({ empty }: { empty?: boolean }) {
  const [active, setActive] = React.useState(1);
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
                age={age || undefined}
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
