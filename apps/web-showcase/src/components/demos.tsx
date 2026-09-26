'use client';

import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
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
import { BrandGlyph } from '@oppenheimer/design-system-web/brand-glyph';
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
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuPaneItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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
import { Rail, RailItem, RailMark } from '@oppenheimer/design-system-web/rail';
import {
  RepositoryRowList,
  type RepositoryRowValue,
} from '@oppenheimer/design-system-web/repository-row-list';
import { SessionItem, SessionList } from '@oppenheimer/design-system-web/session-item';
import {
  SidebarEmptyRow,
  SidebarProjectHeader,
  SidebarSearch,
} from '@oppenheimer/design-system-web/sidebar';
import { Stepper } from '@oppenheimer/design-system-web/stepper';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oppenheimer/design-system-web/tooltip';
import { Wordmark } from '@oppenheimer/design-system-web/wordmark';
import { Callout } from '@oppenheimer/design-system-web/callout';
import { FieldSelect } from '@oppenheimer/design-system-web/field-select';
import { HostCard } from '@oppenheimer/design-system-web/host-card';
import {
  AddRow,
  InlineToken,
  TokenLiveDot,
  TokenMono,
  TokenSentence,
  TriggerCard,
  WeekdayStrip,
} from '@oppenheimer/design-system-web/inline-token';
import {
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderNote,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderTitleInput,
} from '@oppenheimer/design-system-web/page-header';
import { PillTab, PillTabs } from '@oppenheimer/design-system-web/pill-tabs';
import { Popover, PopoverTrigger } from '@oppenheimer/design-system-web/popover';
import {
  RoutineItem,
  RoutineRun,
  RoutineRunList,
  RoutineRunsEmpty,
} from '@oppenheimer/design-system-web/routine-item';
import { RoutineStep, RoutineStepFields, RoutineSteps } from '@oppenheimer/design-system-web/routine-steps';
import {
  RoutineTable,
  RoutineTableHead,
  RoutineTableRow,
} from '@oppenheimer/design-system-web/routine-table';
import { RunHistory, type RunHistoryDay } from '@oppenheimer/design-system-web/run-history';
import {
  RunRow,
  RunsList,
  RunsListFilters,
  RunsListFoot,
  RunsListHead,
} from '@oppenheimer/design-system-web/runs-list';
import {
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
  SettingsSaveRow,
} from '@oppenheimer/design-system-web/settings-group';
import {
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
} from '@oppenheimer/design-system-web/settings-nav';
import { TemplateGrid, TemplateItem } from '@oppenheimer/design-system-web/template-grid';
import { TimeGrid } from '@oppenheimer/design-system-web/time-grid';
import { ChipSelectPopup } from '@oppenheimer/design-system-web/chip-select';
import { Input } from '@oppenheimer/design-system-web/input';
import { Textarea } from '@oppenheimer/design-system-web/textarea';
import {
  ChevronDownIcon,
  ClockIcon,
  CpuIcon,
  EllipsisIcon,
  FileTextIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  GlobeIcon,
  LogOutIcon,
  MoonIcon,
  PlayIcon,
  PlusIcon,
  Settings2Icon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  TriangleAlertIcon,
  UserIcon,
  ZapIcon,
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
        </DialogHeader>
        <DialogBody className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">Run this once on the host</span>
            <CodeBlock
              layout="panel"
              code={tab === 'cmd' ? INSTALL : PROMPT}
              tabs={[
                { value: 'cmd', label: 'Command' },
                { value: 'prompt', label: 'Agent prompt' },
              ]}
              tab={tab}
              onTabChange={setTab}
            />
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
  const [pane, setPane] = React.useState<'root' | 'theme' | 'lang'>('root');
  const [theme, setTheme] = React.useState('system');
  const [lang, setLang] = React.useState('en');
  const themeLabel = { light: 'Light', dark: 'Dark', system: 'Match system' }[theme];
  const langLabel = { en: 'English', es: 'Español' }[lang];
  return (
    <DropdownMenu onOpenChange={(open) => !open && setPane('root')}>
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
        <ChevronDownIcon className="size-3.5 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="min-w-62.5">
        {pane === 'root' ? (
          <>
            <DropdownMenuHeader>jordiparra99@gmail.com</DropdownMenuHeader>
            <DropdownMenuItem>
              <SlidersHorizontalIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuPaneItem value={themeLabel} onClick={() => setPane('theme')}>
              <MoonIcon /> Appearance
            </DropdownMenuPaneItem>
            <DropdownMenuPaneItem value={langLabel} onClick={() => setPane('lang')}>
              <GlobeIcon /> Language
            </DropdownMenuPaneItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOutIcon /> Log out
            </DropdownMenuItem>
          </>
        ) : pane === 'theme' ? (
          <>
            <DropdownMenuBack onClick={() => setPane('root')}>Appearance</DropdownMenuBack>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : (
          <>
            <DropdownMenuBack onClick={() => setPane('root')}>Language</DropdownMenuBack>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={lang} onValueChange={setLang}>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="es">Español</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


/* ── Engine: agent + model, effort, permissions ───────────────────────── */

/**
 * The engine button's rows, read off the product's own catalog rather than
 * kept by hand here, so the gallery shows the agents and seed models the
 * console offers and cannot fall a model behind it.
 */
export const HARNESSES: AgentOption[] = CODING_AGENT_IDS.map((id) => ({
  id,
  label: CODING_AGENTS[id].label,
  models: CODING_AGENTS[id].models.map((model) => ({ value: model.id, label: model.label })),
}));

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
  const [engine, setEngine] = React.useState<Engine>({ agent: 'claude-code', model: 'claude-opus-5-5' });
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
export function ScopeChips({ variant }: { variant?: 'chip' | 'tab' }) {
  const [host, setHost] = React.useState<string | null>('optimus');
  const [scope, setScope] = React.useState<RepositoryScope[]>([{ id: 'xrp-mobile', branch: 'main' }]);
  const single = scope.length === 1 ? scope[0] : undefined;
  const singleRepo = single ? REPOS.find((r) => r.id === single.id) : undefined;
  return (
    <div className={variant === 'tab' ? 'contents' : 'flex flex-wrap items-center gap-2'}>
      <ChipSelect
        value={host}
        onValueChange={setHost}
        options={HOSTS}
        variant={variant}
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
        variant={variant}
        action={{
          label: 'Manage repository access',
          icon: <BrandGlyph name="github" size={15} />,
          href: 'https://github.com/settings/installations',
        }}
      />
      {single && singleRepo ? (
        <ChipSelect
          value={single.branch}
          onValueChange={(branch) => setScope([{ id: single.id, branch }])}
          options={singleRepo.branches.map((b) => ({ value: b.value, label: b.value, mono: true }))}
          variant={variant}
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
        scope={full ? <ScopeChips variant="tab" /> : undefined}
      />
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

type DemoState = 'running' | 'needs-input' | 'failed' | 'idle' | 'pending';
type DemoProject = { name: string; sessions: [string, string, DemoState][] };

const PROJECTS: DemoProject[] = [
  {
    name: 'XRP Mobile',
    sessions: [
      ['PR #121 porting to peersyst', '2m', 'running'],
      ['XRP Mobile API cleanup', '3h', 'needs-input'],
      ['tool router', '1d', 'idle'],
    ],
  },
  {
    name: 'Atlas',
    sessions: [
      ['nightly ingest', '14m', 'running'],
      ['invoice triage', '1h', 'needs-input'],
      ['retriever eval', '5h', 'failed'],
      ['doc summariser', '2d', 'idle'],
    ],
  },
  { name: 'Client sites', sessions: [] },
];

function RowMenu({
  open,
  onOpenChange,
  onRename,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  projects: string[];
}) {
  const [pane, setPane] = React.useState<'root' | 'move'>('root');
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPane('root');
      }}
    >
      <DropdownMenuTrigger render={<IconButton aria-label="Session actions" size="xs" variant="quiet" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-47.5">
        {pane === 'root' ? (
          <>
            <DropdownMenuItem onClick={onRename}>
              Rename <DropdownMenuShortcut>R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuPaneItem onClick={() => setPane('move')}>
              Move to project… <DropdownMenuShortcut className="ml-0">M</DropdownMenuShortcut>
            </DropdownMenuPaneItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              Delete <DropdownMenuShortcut>D</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuBack onClick={() => setPane('root')}>Move to project</DropdownMenuBack>
            <DropdownMenuSeparator />
            {projects.map((name) => (
              <DropdownMenuItem key={name}>{name}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <PlusIcon /> New project…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SidebarDemo({ empty }: { empty?: boolean }) {
  const [active, setActive] = React.useState('PR #121 porting to peersyst');
  const [query, setQuery] = React.useState('');
  const [filters, setFilters] = React.useState<string[]>(empty ? [] : ['Host: optimus']);
  const [closed, setClosed] = React.useState<string[]>([]);
  const [menu, setMenu] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<{ name: string; draft: string } | null>(null);
  const [names, setNames] = React.useState<Record<string, string>>({});
  const term = query.trim().toLowerCase();
  const projects = empty ? [] : PROJECTS;
  const total = projects.reduce((n, p) => n + p.sessions.length, 0);
  return (
    <div className="flex h-[600px] shrink-0 overflow-hidden">
      <Rail>
        <RailMark>O</RailMark>
        <RailItem label="Sessions" count={total} active>
          <TerminalIcon />
        </RailItem>
        <RailItem label="Routines" count={5}>
          <ZapIcon />
        </RailItem>
      </Rail>
      <div className="flex w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center px-4">
          <Wordmark product="Console" />
        </div>
        <div className="px-3">
          <Button variant={empty ? 'secondary' : 'primary'} size="md" block>
            New session
          </Button>
        </div>
        <div className="mt-4 flex h-[26px] items-center gap-2 pr-2.5 pl-5">
          <span className="eyebrow">Projects</span>
          <span className="figures ml-auto text-[11px] text-sidebar-muted">{projects.length}</span>
          <IconButton aria-label="New project" size="xs" variant="quiet">
            <PlusIcon />
          </IconButton>
          <FilterMenuDemo />
        </div>
        <SidebarSearch value={query} onValueChange={setQuery} placeholder="Search sessions" />
        {filters.length ? (
          <div className="flex flex-wrap gap-1 px-3 pb-2">
            {filters.map((f) => (
              <FilterChip key={f} onRemove={() => setFilters((x) => x.filter((y) => y !== f))}>
                {f}
              </FilterChip>
            ))}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {empty ? (
            <div className="px-3">
              <EmptyState compact>
                <EmptyState.Header>
                  <EmptyState.Description>
                    No projects yet. The first one you create appears here with its sessions.
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            </div>
          ) : (
            projects.map((project) => {
              const open = !closed.includes(project.name);
              const rows = project.sessions.filter(([name]) =>
                term ? (names[name] ?? name).toLowerCase().includes(term) : true,
              );
              return (
                <div key={project.name} className="mt-1.5 flex flex-col">
                  <SidebarProjectHeader
                    name={project.name}
                    count={project.sessions.length}
                    open={open}
                    onOpenChange={(next) =>
                      setClosed((c) => (next ? c.filter((n) => n !== project.name) : [...c, project.name]))
                    }
                    current={project.sessions.some(([name]) => name === active)}
                    actions={
                      <>
                        <IconButton aria-label="New session here" size="xs" variant="quiet">
                          <PlusIcon />
                        </IconButton>
                        <IconButton aria-label={`${project.name} settings`} size="xs" variant="quiet">
                          <SettingsIcon />
                        </IconButton>
                      </>
                    }
                  />
                  {open ? (
                    project.sessions.length === 0 ? (
                      <SidebarEmptyRow>
                        No sessions yet. <button type="button">Start one</button>
                      </SidebarEmptyRow>
                    ) : (
                      <SessionList className="px-3">
                        {rows.map(([name, age, state]) => (
                          <SessionItem
                            key={name}
                            name={names[name] ?? name}
                            age={age || undefined}
                            state={state}
                            active={name === active}
                            onClick={() => setActive(name)}
                            menuOpen={menu === name}
                            rename={
                              renaming?.name === name
                                ? {
                                    value: renaming.draft,
                                    onValueChange: (draft) => setRenaming({ name, draft }),
                                    onCommit: () => {
                                      setNames((n) => ({ ...n, [name]: renaming.draft || name }));
                                      setRenaming(null);
                                    },
                                    onCancel: () => setRenaming(null),
                                  }
                                : undefined
                            }
                            action={
                              <RowMenu
                                open={menu === name}
                                onOpenChange={(next) => setMenu(next ? name : null)}
                                onRename={() => setRenaming({ name, draft: names[name] ?? name })}
                                projects={PROJECTS.filter((p) => p.name !== project.name).map((p) => p.name)}
                              />
                            }
                          />
                        ))}
                      </SessionList>
                    )
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-sidebar-border px-2 py-2">
          <AccountMenuDemo />
        </div>
      </div>
    </div>
  );
}

/* ── Stepper ─────────────────────────────────────────────────────────────── */

const BOOT = [
  ['host', 'Reaching mac-studio', 'echo 38 ms'],
  ['clone', 'Cloning xrp-mobile', 'cloning 41 MB…'],
  ['branch', 'Checking out main', 'opp/680000'],
  ['agent', 'Starting Claude Code', 'tmux attach…'],
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
  return (
    <div className="w-full max-w-[420px]">
      <div className="eyebrow figures">mac-studio</div>
      <h3 className="mt-2 text-h2 font-semibold">Starting your session</h3>
      <p className="mt-1.5 text-operate text-fg-muted">JordiParraCrespo/xrp-mobile · main</p>
      <Stepper
        className="mt-6"
        steps={BOOT.map(([id, label, meta], i) => ({
          id,
          label,
          meta: i < step ? `${(0.6 + i * 0.7).toFixed(1)}s` : i === step ? meta : undefined,
          state: i < step ? 'done' : i === step ? 'running' : 'pending',
        }))}
        elapsed={`${(t * 0.9).toFixed(1)}s`}
        status={step >= BOOT.length ? 'Handing off to the terminal' : 'Working…'}
      />
    </div>
  );
}

/* ── Terminal ────────────────────────────────────────────────────────────── */

/** The link item flips every few seconds so both states are on the page. */
function LinkDemo() {
  const [live, setLive] = React.useState(true);
  React.useEffect(() => {
    const id = setInterval(() => setLive((v) => !v), 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <TerminalStatusLink state={live ? 'live' : 'reconnecting'}>
      {live ? 'Live' : 'Reconnecting…'}
    </TerminalStatusLink>
  );
}

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
          <LinkDemo />
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

/* ── RepositoryRowList ───────────────────────────────────────────────────── */

const PROJECT_REPOS = [
  { id: 'xrp-mobile', name: 'xrp-mobile', defaultBranch: 'main', branches: [{ value: 'main', description: 'default · updated 3h ago' }, { value: 'develop', description: 'updated 1d ago' }, { value: 'port/121-api-config-hardening', description: 'ahead 4 · updated 32m ago' }] },
  { id: 'atlas', name: 'atlas', defaultBranch: 'develop', branches: [{ value: 'develop', description: 'default' }, { value: 'main' }] },
  { id: 'flama-ai', name: 'flama-ai', defaultBranch: 'main', branches: [{ value: 'main', description: 'default' }] },
  { id: 'adri-rodriguez', name: 'adri-rodriguez', defaultBranch: 'main', branches: [{ value: 'main', description: 'default' }] },
];

export function RepositoryRowListDemo() {
  const [rows, setRows] = React.useState<RepositoryRowValue[]>([
    { id: 'xrp-mobile', isDefault: true, branch: 'main' },
    { id: 'atlas', isDefault: false, branch: 'develop' },
  ]);
  const defaults = rows.filter((r) => r.isDefault).length;
  return (
    <div className="flex w-full max-w-[484px] flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-fg">Default repositories</span>
        <span className="figures text-[11.5px] text-fg-subtle">
          {defaults} of {rows.length} by default
        </span>
      </div>
      <RepositoryRowList repositories={PROJECT_REPOS} value={rows} onValueChange={setRows} />
    </div>
  );
}

/* ── Callout ─────────────────────────────────────────────────────────────── */

export function CalloutDemo() {
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3.5">
      <Callout>No account yet for that sign-in. The provider buttons create one in a single step.</Callout>
      <Callout tone="info">
        A worktree is created per session, so two runs on one repository never share a checkout.
      </Callout>
      <Callout tone="success">Runner connected. 12 repositories are available to this host.</Callout>
      <Callout tone="warning">This host has been unreachable for 6 minutes. Sessions on it are paused.</Callout>
      <Callout tone="danger">The install token expired. Generate a new one and run the command again.</Callout>
    </div>
  );
}

/* ── PillTabs ────────────────────────────────────────────────────────────── */

export function PillTabsDemo() {
  const [view, setView] = React.useState('routines');
  const [status, setStatus] = React.useState('all');
  return (
    <div className="flex flex-col gap-4">
      <PillTabs value={view} onValueChange={setView} aria-label="View">
        <PillTab value="routines">Routines</PillTab>
        <PillTab value="runs">Runs</PillTab>
      </PillTabs>
      <div className="rounded-lg bg-card p-1.5">
        <PillTabs value={status} onValueChange={setStatus} size="sm" aria-label="Status">
          <PillTab value="all" count={48}>
            All
          </PillTab>
          <PillTab value="running" count={1}>
            Running
          </PillTab>
          <PillTab value="succeeded" count={44}>
            Succeeded
          </PillTab>
          <PillTab value="failed" count={3}>
            Failed
          </PillTab>
        </PillTabs>
      </div>
    </div>
  );
}

/* ── PageHeader ──────────────────────────────────────────────────────────── */

export function PageHeaderDemo() {
  const [paused, setPaused] = React.useState(true);
  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader>
        <PageHeaderCrumbs>
          <button type="button">Routines</button>
          <span>/</span>
          <PageHeaderHere>Nightly dependency audit</PageHeaderHere>
        </PageHeaderCrumbs>
        <PageHeaderRow
          size="lg"
          icon={<ClockIcon />}
          title="Nightly dependency audit"
          actions={
            <>
              <Button variant="secondary" size="sm">
                <PlayIcon /> Run now
              </Button>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
              <IconButton aria-label="More" size="sm">
                <EllipsisIcon />
              </IconButton>
            </>
          }
        />
        <PageHeaderMeta>
          <StatusDot state={paused ? 'paused' : 'active'} className="items-center text-[13px]">
            {paused ? 'Paused' : 'Active'}
          </StatusDot>
          <PageHeaderSep />
          <span>Every weekday at 09:00</span>
          <PageHeaderSep />
          <span>XRP Mobile · optimus</span>
        </PageHeaderMeta>
        {paused ? (
          <PageHeaderNote
            action={
              <Button variant="secondary" size="sm" onClick={() => setPaused(false)}>
                Resume
              </Button>
            }
          >
            Paused. Triggers are ignored until you resume it; Run now still works.
          </PageHeaderNote>
        ) : null}
      </PageHeader>
      <PageHeader>
        <PageHeaderCrumbs>
          <button type="button">Routines</button>
          <span>/</span>
          <PageHeaderHere>New routine</PageHeaderHere>
        </PageHeaderCrumbs>
        <PageHeaderRow
          icon={<ZapIcon />}
          title={<PageHeaderTitleInput placeholder="Name this routine" aria-label="Routine name" />}
          actions={
            <>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
              <Button size="sm" disabled>
                Create routine
              </Button>
            </>
          }
        />
        <PageHeaderMeta>Name the routine to continue.</PageHeaderMeta>
      </PageHeader>
    </div>
  );
}

/* ── RunHistory ──────────────────────────────────────────────────────────── */

const HISTORY: RunHistoryDay[] = Array.from({ length: 30 }, (_, i) => {
  const ok = i < 5 ? [1, 2, 2, 3, 3][i] : i === 5 ? 0 : i < 12 ? [2, 3, 2, 3, 4, 0, 0][i - 6] : i < 18 ? [3, 3, 3, 3, 3, 0][i - 12] : i < 24 ? [0, 3, 4, 3, 3, 2][i - 18] : [0, 0, 3, 3, 0, 0][i - 24];
  const failed = i === 3 || i === 10 || i === 21 ? 1 : 0;
  return { date: `2026-${i < 4 ? '08' : '09'}-${String(i < 4 ? 27 + i : i - 3).padStart(2, '0')}`, ok, failed };
});

export function RunHistoryDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <RunHistory days={HISTORY} axis={['27 Aug', '26 Sep']} />
      <RunHistory days={HISTORY} axis={['27 Aug', '26 Sep']} link={{ label: '65 runs' }} />
    </div>
  );
}

/* ── RoutineTable ────────────────────────────────────────────────────────── */

export function RoutineTableDemo() {
  return (
    <RoutineTable className="w-full">
      <RoutineTableHead />
      <RoutineTableRow
        icon={<ClockIcon />}
        name="Nightly dependency audit"
        sub="XRP Mobile · Claude Code"
        trigger="Every weekday at 09:00"
        next="Mon 09:00"
        nextRelative="in 2d 14h"
        status="active"
        statusLabel="Active"
        action={
          <IconButton aria-label="Routine actions" size="sm">
            <EllipsisIcon />
          </IconButton>
        }
      />
      <RoutineTableRow
        icon={<BrandGlyph name="github" size={14} />}
        name="Review new pull requests"
        sub="Atlas · Codex"
        trigger="When a PR is opened on main"
        next="On event"
        status="running"
        statusLabel="Running"
        action={
          <IconButton aria-label="Routine actions" size="sm">
            <EllipsisIcon />
          </IconButton>
        }
      />
      <RoutineTableRow
        icon={<ClockIcon />}
        name="Weekly changelog"
        sub="Flama AI · Claude Code"
        trigger="Fridays at 17:00"
        next="—"
        status="paused"
        statusLabel="Paused"
        paused
        action={
          <IconButton aria-label="Routine actions" size="sm">
            <EllipsisIcon />
          </IconButton>
        }
      />
    </RoutineTable>
  );
}

/* ── RunsList ────────────────────────────────────────────────────────────── */

export function RunsListDemo() {
  const [status, setStatus] = React.useState('all');
  return (
    <RunsList className="w-full">
      <RunsListFilters>
        <PillTabs value={status} onValueChange={setStatus} size="sm" aria-label="Status">
          <PillTab value="all" count={65}>
            All
          </PillTab>
          <PillTab value="completed" count={62}>
            Completed
          </PillTab>
          <PillTab value="failed" count={3}>
            Failed
          </PillTab>
          <PillTab value="running" count={0}>
            Running
          </PillTab>
        </PillTabs>
        <span className="flex-1" />
        <InlineToken size="sm">All routines</InlineToken>
        <InlineToken size="sm">All projects</InlineToken>
        <InlineToken size="sm">Last 30 days</InlineToken>
      </RunsListFilters>
      <RunsListHead />
      <RunRow state="failed" title="Dependency audit · 3 safe bumps" routine="Nightly dependency audit" date="Sep 26" time="02:00" />
      <RunRow state="completed" title="Review #124 · Harden API config loading" routine="Review new pull requests" date="Sep 25" time="18:08" />
      <RunRow state="running" title="Standup digest · Fri 25 Sep" routine="Standup digest" date="Sep 25" time="08:30" />
      <RunsListFoot range="1–3 of 65" onNext={() => {}} />
    </RunsList>
  );
}

/* ── TemplateGrid ────────────────────────────────────────────────────────── */

export function TemplateGridDemo() {
  const [cat, setCat] = React.useState('all');
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 flex-1 text-[17px] font-semibold tracking-[-0.012em]">Templates</h3>
        <PillTabs value={cat} onValueChange={setCat} size="sm" aria-label="Category">
          <PillTab value="all">All</PillTab>
          <PillTab value="review">Review</PillTab>
          <PillTab value="maintenance">Maintenance</PillTab>
          <PillTab value="reporting">Reporting</PillTab>
        </PillTabs>
      </div>
      <TemplateGrid>
        <TemplateItem
          icon={<GitPullRequestIcon />}
          name="Pull request review"
          description="Reviews each new pull request against your contributing guide and posts one verdict."
          meta={
            <>
              <BrandGlyph name="github" size={12} /> On pull request opened
            </>
          }
          action={
            <Button variant="secondary" size="sm">
              Add
            </Button>
          }
        />
        <TemplateItem
          icon={<TriangleAlertIcon />}
          name="Fix failing checks"
          description="Reproduces a red check on the same branch and pushes the smallest fix."
          meta={
            <>
              <BrandGlyph name="github" size={12} /> On check failed
            </>
          }
          action={
            <Button variant="secondary" size="sm">
              Add
            </Button>
          }
        />
        <TemplateItem
          icon={<ShieldCheckIcon />}
          name="Dependency audit"
          description="Scans manifests for advisories and opens one PR with the safe bumps."
          meta={
            <>
              <ClockIcon /> Every Mon at 07:00
            </>
          }
          action={
            <Button variant="secondary" size="sm">
              Add
            </Button>
          }
        />
        <TemplateItem
          icon={<FileTextIcon />}
          name="Release notes drafter"
          description="Drafts user-facing notes each time a pull request merges to main."
          meta={
            <>
              <BrandGlyph name="github" size={12} /> On pull request merged
            </>
          }
          action={
            <Button variant="secondary" size="sm">
              Add
            </Button>
          }
        />
      </TemplateGrid>
    </div>
  );
}

/* ── RoutineSteps · FieldSelect · InlineToken · TimeGrid ────────────────── */

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => `${String(h).padStart(2, '0')}:00`);

export function TimeTokenDemo() {
  const [open, setOpen] = React.useState(false);
  const [time, setTime] = React.useState('09:00');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<InlineToken mono open={open} />}>{time}</PopoverTrigger>
      <ChipSelectPopup width={292} maxHeight={480} side="bottom" align="start" className="p-3">
        <TimeGrid
          groups={[
            { label: 'Morning', cells: HOURS.slice(0, 6).map((h) => ({ value: h, label: h, disabled: h < '08:00' })) },
            { label: 'Afternoon', cells: HOURS.slice(6).map((h) => ({ value: h, label: h })) },
          ]}
          value={time}
          onValueChange={(next) => {
            setTime(next);
            setOpen(false);
          }}
        />
      </ChipSelectPopup>
    </Popover>
  );
}

export function RoutineEditorDemo() {
  const [project, setProject] = React.useState<string | null>('xrp');
  const [repos, setRepos] = React.useState<string[]>(['xrp-mobile']);
  const [host, setHost] = React.useState<string | null>('optimus');
  const [days, setDays] = React.useState('weekdays');
  const [what, setWhat] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  return (
    <RoutineSteps className="w-full">
      <RoutineStep number={1} title="Where" subtitle="The code it works on, and the machine it runs on." done summary="XRP Mobile · optimus">
        <RoutineStepFields>
          <Field>
            <FieldLabel>Project</FieldLabel>
            <FieldSelect
              value={project}
              onValueChange={setProject}
              meta="1 repo"
              searchPlaceholder="Search projects"
              options={[
                { value: 'xrp', label: 'XRP Mobile', description: 'xrp-mobile' },
                { value: 'atlas', label: 'Atlas', description: 'atlas, flama-ai' },
                { value: 'client', label: 'Client sites', description: 'flama-ai, adri-rodriguez' },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel>Repositories</FieldLabel>
            <FieldSelect
              multiple
              value={repos}
              onValueChange={setRepos}
              searchPlaceholder="Search repositories"
              options={[
                { value: 'xrp-mobile', label: 'xrp-mobile', description: 'default · main', group: 'In XRP Mobile' },
                { value: 'atlas', label: 'atlas', description: 'optional · develop', group: 'In XRP Mobile' },
                { value: 'flama-ai', label: 'flama-ai', description: 'not in project' },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel>Host</FieldLabel>
            <FieldSelect
              value={host}
              onValueChange={setHost}
              meta="idle"
              searchPlaceholder="Search hosts"
              options={[
                { value: 'optimus', label: 'optimus', description: 'Ubuntu 24.04 · idle' },
                { value: 'mac', label: 'jordis-mac-studio', description: 'macOS 15 · running' },
                { value: 'fable', label: 'fable', description: 'Debian 12 · offline', disabled: true },
              ]}
            />
          </Field>
        </RoutineStepFields>
      </RoutineStep>
      <RoutineStep number={2} title="When" subtitle="Any trigger starts a run." done summary="Weekdays at 09:00">
        <TriggerCard
          icon={<ClockIcon />}
          onRemove={() => {}}
          preview={
            <>
              <WeekdayStrip
                days={['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => ({
                  label,
                  fires: days === 'weekdays' ? i > 0 && i < 6 : true,
                  next: i === 1,
                }))}
              />
              <span>Next run</span>
              <TokenMono>Mon 28 Sep, 09:00</TokenMono>
              <span>· in</span>
              <TokenMono>1d 21h 26m</TokenMono>
            </>
          }
        >
          <TokenSentence>
            <span>Every</span>
            <InlineToken onClick={() => setDays((d) => (d === 'weekdays' ? 'day' : 'weekdays'))}>
              {days === 'weekdays' ? 'weekday' : 'day'}
            </InlineToken>
            <span>at</span>
            <TimeTokenDemo />
            <span>CEST</span>
          </TokenSentence>
        </TriggerCard>
        <TriggerCard
          icon={<BrandGlyph name="github" size={14} />}
          onRemove={() => {}}
          preview={
            <>
              <TokenLiveDot />
              <span>Listening on xrp-mobile · would have run 4 times in the last 7 days</span>
            </>
          }
        >
          <TokenSentence>
            <span>When a pull request is</span>
            <InlineToken>opened</InlineToken>
            <span>against</span>
            <InlineToken mono>main</InlineToken>
          </TokenSentence>
        </TriggerCard>
        <AddRow open={addOpen} onClick={() => setAddOpen((o) => !o)}>
          Add another trigger
        </AddRow>
      </RoutineStep>
      <RoutineStep
        number={3}
        title="What"
        subtitle="Instructions for every run."
        note="The pull request, issue or commit that fired the run is passed in as context."
      >
        <Textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="What should the agent do each time it runs?"
          className="min-h-28"
        />
      </RoutineStep>
      <RoutineStep
        number={4}
        title="Agent"
        subtitle="Each run is its own session."
        done
        summary="Claude Code · Claude Sonnet 4.6"
        note="Works on a fresh opp/ branch, so nothing lands on main without a pull request."
        last
      >
        <RoutineStepFields>
          <Field>
            <FieldLabel>Agent</FieldLabel>
            <FieldSelect value="claude" onValueChange={() => {}} options={[{ value: 'claude', label: 'Claude Code' }, { value: 'codex', label: 'Codex' }]} />
          </Field>
          <Field>
            <FieldLabel>Model</FieldLabel>
            <FieldSelect value="sonnet" onValueChange={() => {}} options={[{ value: 'sonnet', label: 'Claude Sonnet 4.6' }, { value: 'opus', label: 'Claude Opus 4.2' }]} />
          </Field>
        </RoutineStepFields>
      </RoutineStep>
    </RoutineSteps>
  );
}

/* ── RoutineItem ─────────────────────────────────────────────────────────── */

export function RoutineItemsDemo() {
  const [active, setActive] = React.useState('review');
  return (
    <div className="flex w-[264px] flex-col gap-px rounded-lg border border-sidebar-border bg-sidebar p-3">
      <RoutineItem name="Review new pull requests" meta={26} icon={<BrandGlyph name="github" size={13} className="opacity-80" />} running active={active === 'review'} onClick={() => setActive('review')} />
      {active === 'review' ? (
        <RoutineRunList>
          <RoutineRun title="Review #124 · Harden API config loading" ago="17h" active />
          <RoutineRun title="Review #123 · Bump react-native to 0.76.3" ago="18h" />
          <RoutineRun title="Review #118 · Split wallet store by account" ago="2d" state="failed" />
        </RoutineRunList>
      ) : null}
      <RoutineItem name="Standup digest" meta="in 45h" active={active === 'standup'} onClick={() => setActive('standup')} />
      {active === 'standup' ? (
        <RoutineRunList>
          <RoutineRunsEmpty>No runs yet.</RoutineRunsEmpty>
        </RoutineRunList>
      ) : null}
      <RoutineItem name="Triage bug reports" meta="Paused" paused icon={<BrandGlyph name="github" size={13} className="opacity-80" />} active={active === 'triage'} onClick={() => setActive('triage')} />
    </div>
  );
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export function SettingsNavDemo() {
  const [page, setPage] = React.useState('profile');
  return (
    <SettingsNav className="h-[360px] rounded-lg border border-sidebar-border">
      <SettingsNavBack>Back to console</SettingsNavBack>
      <SettingsNavGroup label="Account">
        <SettingsNavItem icon={<UserIcon />} active={page === 'profile'} onClick={() => setPage('profile')}>
          Profile
        </SettingsNavItem>
      </SettingsNavGroup>
      <SettingsNavGroup label="Workspace">
        <SettingsNavItem icon={<CpuIcon />} count={3} active={page === 'hosts'} onClick={() => setPage('hosts')}>
          Hosts
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsNav>
  );
}

export function SettingsGroupDemo() {
  const [name, setName] = React.useState('Jordi Parra Crespo');
  const dirty = name !== 'Jordi Parra Crespo';
  return (
    <div className="flex w-full max-w-[680px] flex-col gap-6">
      <SettingsGroup>
        <SettingsRow label="Profile picture" hint="Shown beside your sessions and routines">
          <Avatar size="lg" variant="accent">
            <AvatarFallback>JP</AvatarFallback>
          </Avatar>
          <Button variant="secondary" size="sm">
            Upload
          </Button>
        </SettingsRow>
        <SettingsRow label="Email" hint="Used to sign in and for run notifications">
          <span>jordiparra99@gmail.com</span>
          <Button variant="secondary" size="sm">
            Change
          </Button>
        </SettingsRow>
        <SettingsRow label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" className="w-[280px]" />
        </SettingsRow>
        {dirty ? (
          <SettingsSaveRow>
            <Button variant="ghost" size="sm" onClick={() => setName('Jordi Parra Crespo')}>
              Discard
            </Button>
            <Button size="sm">Save changes</Button>
          </SettingsSaveRow>
        ) : null}
      </SettingsGroup>
      <SettingsHeading>Account</SettingsHeading>
      <SettingsGroup>
        <SettingsRow label="Delete account" hint="Stops every session and removes your routines and host registrations. This cannot be undone.">
          <Button variant="destructive" size="sm">
            Delete account
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}

export function HostCardsDemo() {
  const action = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<IconButton aria-label="Host actions" size="sm" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-50">
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem>
          Copy host ID <DropdownMenuShortcut className="figures">h_b40e</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Remove host</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div className="flex w-full max-w-[680px] flex-col gap-2.5">
      <HostCard name="jordis-mac-studio" meta="macOS 15 · local · runner 0.14.2" status="running" state="Running · 2 sessions" seen="connected" action={action} />
      <HostCard name="optimus" meta="Ubuntu 24.04 · 32 vCPU · eu-west · runner 0.14.2" status="idle" state="Idle" seen="connected" action={action} />
      <HostCard name="fable" meta="Debian 12 · 16 vCPU · us-east · runner 0.13.8" status="offline" state="Offline" seen="last seen 2 days ago" action={action} />
    </div>
  );
}
