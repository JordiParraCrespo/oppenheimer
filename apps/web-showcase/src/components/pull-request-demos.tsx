'use client';

import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Badge } from '@oppenheimer/design-system-web/badge';
import { Button } from '@oppenheimer/design-system-web/button';
import { DiffStat } from '@oppenheimer/design-system-web/diff-stat';
import { DiffCommentLink } from '@oppenheimer/design-system-web/diff-view';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  FileTextIcon,
  SearchIcon,
  SquareArrowOutUpRightIcon,
  TerminalIcon,
} from '@oppenheimer/design-system-web/icons';
import { Kbd } from '@oppenheimer/design-system-web/kbd';
import { MergePath } from '@oppenheimer/design-system-web/merge-path';
import { PageHeader, PageHeaderMeta, PageHeaderRow, PageHeaderSep, PageHeaderStat } from '@oppenheimer/design-system-web/page-header';
import { Panel, PanelGrid } from '@oppenheimer/design-system-web/panel';
import { PillTab, PillTabs } from '@oppenheimer/design-system-web/pill-tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@oppenheimer/design-system-web/popover';
import { Prose } from '@oppenheimer/design-system-web/prose';
import { PullRequestHeader } from '@oppenheimer/design-system-web/pull-request-header';
import { MergeButton, PullRequestRow, PullRequestTable, PullRequestTableHead } from '@oppenheimer/design-system-web/pull-request-table';
import { ReviewDecision, SubmitReviewButton } from '@oppenheimer/design-system-web/review-decision';
import { RunsListFoot } from '@oppenheimer/design-system-web/runs-list';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import { FactGrid, FactTile, StatBar, StatCard } from '@oppenheimer/design-system-web/stat-card';
import { StatusDot, type StatusState } from '@oppenheimer/design-system-web/status-dot';
import type { Step } from '@oppenheimer/design-system-web/stepper';
import * as React from 'react';

import { PR_FILES } from './pull-request-fixtures';

type Lane = 'deep' | 'medium' | 'quick';
type Checks = 'passing' | 'failing' | 'running';

interface Pull {
  id: number;
  lane: Lane;
  title: string;
  reference: string;
  author: string;
  person?: boolean;
  note?: string;
  noteTone?: 'danger' | 'warning';
  needsOwner?: boolean;
  additions: number;
  deletions: number;
  checks: Checks;
  conflicts: boolean;
  waiting: string;
  late?: boolean;
}

const PULLS: Pull[] = [
  { id: 482, lane: 'deep', title: 'Move session tokens to the runner keychain', reference: 'oppenheimer #482', author: 'Session · auth-hardening', additions: 612, deletions: 248, checks: 'passing', conflicts: false, waiting: '1d 3h', late: true },
  { id: 135, lane: 'deep', title: 'Drop the legacy token file reader', reference: 'runner #135', author: 'Session · auth-cleanup', additions: 58, deletions: 310, checks: 'passing', conflicts: true, waiting: '18h 24m', late: true },
  { id: 134, lane: 'medium', title: 'Retry host registration with backoff', reference: 'runner #134', author: 'Session · host-retry', additions: 96, deletions: 22, checks: 'passing', conflicts: false, waiting: '7h 30m' },
  { id: 492, lane: 'medium', title: 'Group sessions by project in search results', reference: 'oppenheimer #492', author: 'Session · search-groups', note: 'Checks failing', noteTone: 'danger', additions: 176, deletions: 31, checks: 'failing', conflicts: false, waiting: '4h 48m' },
  { id: 131, lane: 'medium', title: 'Report disk pressure above 90%', reference: 'runner #131', author: 'Session · disk-pressure', note: 'Checks running', additions: 118, deletions: 7, checks: 'running', conflicts: false, waiting: '1h 24m' },
  { id: 57, lane: 'quick', title: 'Document the review lanes', reference: 'docs #57', author: 'Pau Serra', person: true, additions: 142, deletions: 3, checks: 'passing', conflicts: false, waiting: '36m' },
  { id: 474, lane: 'quick', title: 'Bump vite to 6.3.2', reference: 'oppenheimer #474', author: 'Session · deps', note: 'Waiting · needs a code owner', noteTone: 'warning', needsOwner: true, additions: 18, deletions: 18, checks: 'passing', conflicts: false, waiting: '5h 48m' },
  { id: 485, lane: 'quick', title: 'Fix typos in session empty states', reference: 'oppenheimer #485', author: 'Session · copy-pass', note: 'Merged 10:42', additions: 6, deletions: 6, checks: 'passing', conflicts: false, waiting: '—' },
];

const LANE_WORD: Record<Lane, string> = { deep: 'Deep', medium: 'Medium', quick: 'Quick' };
const CHECK_STATE: Record<Checks, StatusState> = { passing: 'passing', failing: 'blocked', running: 'waiting' };
const CHECK_WORD: Record<Checks, string> = { passing: 'Passing', failing: 'Failing', running: 'Running' };

/**
 * Why a pull request cannot merge yet, or nothing when it can: the one
 * place the showcase decides it, read by the queue and the briefing alike.
 * In the console this rule is the product's, not the design system's.
 */
function mergeBlocker(pull: Pull): string | undefined {
  if (pull.conflicts) return 'Resolve conflicts with main first';
  if (pull.checks !== 'passing') return 'Waiting on checks';
  if (pull.needsOwner) return 'Needs a code owner';
  return undefined;
}

function LaneBadge({ lane }: { lane: Lane }) {
  return <Badge variant={lane === 'deep' ? 'strong' : 'soft'}>{LANE_WORD[lane]}</Badge>;
}

/**
 * The queue: the page's display header and its one primary action, the
 * scopes, then the table with its search and lane filters, rows that merge
 * in place after one confirm, and the paged foot.
 */
export function PullRequestQueueDemo() {
  const [scope, setScope] = React.useState('mine');
  const [lane, setLane] = React.useState<'all' | Lane>('all');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<number | null>(null);
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const [merged, setMerged] = React.useState<number[]>([485]);
  const term = query.trim().toLowerCase();
  const rows = PULLS.filter(
    (p) => (lane === 'all' || p.lane === lane) && (!term || `${p.title} ${p.reference} ${p.author}`.toLowerCase().includes(term)),
  );
  const count = (l: Lane) => PULLS.filter((p) => p.lane === l).length;

  return (
    <div className="flex w-full flex-col gap-6 rounded-xl bg-canvas px-8 pt-10 pb-10">
      <PageHeader>
        <PageHeaderRow
          size="display"
          title="PR queue"
          actions={
            <Button>
              <ArrowRightIcon />
              Review next
              <Kbd className="ml-1">N</Kbd>
            </Button>
          }
        />
        <PageHeaderMeta indent={false}>
          <PageHeaderStat value={7}>ready to merge</PageHeaderStat>
          <PageHeaderSep />
          <PageHeaderStat value={1}>with conflicts</PageHeaderStat>
          <PageHeaderSep />
          <span>
            oldest waiting <span className="figures text-fg">1d 3h</span>
          </span>
        </PageHeaderMeta>
      </PageHeader>
      <div className="flex flex-col gap-2.5">
        <SegmentedControl size="lg" value={scope} onValueChange={setScope} aria-label="Whose pull requests">
          <SegmentedControlItem value="mine" count={13}>
            Mine
          </SegmentedControlItem>
          <SegmentedControlItem value="requested" count={3}>
            Review requests
          </SegmentedControlItem>
          <SegmentedControlItem value="watching" count={2}>
            Watching
          </SegmentedControlItem>
        </SegmentedControl>
        <p className="m-0 text-sm text-fg-muted">
          Opened by you or your sessions. The review agent reviews each one first, so you check its notes and merge.
        </p>
      </div>
      <PullRequestTable>
        <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-2">
          <label className="flex h-8 w-65 items-center gap-2 rounded-pill bg-hover-surface px-3 text-fg-subtle">
            <SearchIcon className="size-3.5" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, repo, #number, author"
              aria-label="Search pull requests"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <span className="flex-1" />
          <PillTabs size="sm" value={lane} onValueChange={(next) => setLane(next as typeof lane)} aria-label="Lane">
            <PillTab value="all" count={PULLS.length}>
              All
            </PillTab>
            {(['deep', 'medium', 'quick'] as const).map((l) => (
              <PillTab key={l} value={l} count={count(l)}>
                {LANE_WORD[l]}
              </PillTab>
            ))}
          </PillTabs>
        </div>
        <PullRequestTableHead />
        {rows.map((p) => (
          <PullRequestRow
            key={p.id}
            lane={<LaneBadge lane={p.lane} />}
            title={p.title}
            reference={p.reference}
            author={p.author}
            authorKind={p.person ? 'person' : 'session'}
            note={p.note}
            noteTone={p.noteTone}
            additions={p.additions}
            deletions={p.deletions}
            checks={CHECK_STATE[p.checks]}
            checksLabel={CHECK_WORD[p.checks]}
            conflicts={p.conflicts ? 'blocked' : 'passing'}
            conflictsLabel={p.conflicts ? 'Conflicts' : 'No conflicts'}
            waiting={p.waiting}
            waitingTone={p.late ? 'late' : undefined}
            selected={selected === p.id}
            onOpen={() => setSelected(p.id)}
            actions={
              <>
                <IconButton size="sm" aria-label="Open changes">
                  <FileTextIcon />
                </IconButton>
                <Button variant="secondary" size="sm">
                  <TerminalIcon />
                  Review
                </Button>
                <MergeButton
                  merged={merged.includes(p.id)}
                  confirming={confirming === p.id}
                  onConfirmingChange={(next) => setConfirming(next ? p.id : null)}
                  onMerge={() => {
                    setMerged((m) => [...m, p.id]);
                    setConfirming(null);
                  }}
                  disabledReason={mergeBlocker(p)}
                  labels={{ confirmTitle: 'Squash and merge into main' }}
                />
              </>
            }
          />
        ))}
        {rows.length === 0 ? <p className="m-0 px-3 py-3.5 text-sm text-fg-muted">No pull request matches “{query}”.</p> : null}
        <RunsListFoot range={`1–${rows.length} of ${rows.length}`} />
      </PullRequestTable>
    </div>
  );
}

const VERDICTS = [
  { value: 'comment', label: 'Comment', description: 'Post your comments without a verdict.' },
  { value: 'approve', label: 'Approve and merge', description: 'Approves as you and merges once required checks pass.' },
  { value: 'changes', label: 'Request changes', description: 'Sends your comments back to the session to fix.' },
];
const SUBMIT: Record<string, string> = { comment: 'Comment', approve: 'Approve and merge', changes: 'Request changes' };

/** What a briefing shows for one pull request, besides the queue's row. */
interface Briefing {
  pull: Pull;
  head: string;
  files: { count: number; folders: string; shares: [number, number] };
  checks: string;
  steps: Step[];
  summary: string;
  note: string;
}

const CLEAN: Briefing = {
  pull: PULLS[0] as Pull,
  head: 'agent/auth-keychain',
  files: { count: 4, folders: 'in 2 folders', shares: [75, 25] },
  checks: '214 / 214',
  steps: [
    { id: 'checks', label: 'Checks', meta: 'All passing', state: 'done' },
    { id: 'conflicts', label: 'Conflicts', meta: 'Merges cleanly', state: 'done' },
    { id: 'review', label: 'Review', meta: '2 pending comments', state: 'pending' },
    { id: 'merge', label: 'Merge', meta: 'Squash into main', state: 'pending' },
  ],
  summary: '2 of 4 done',
  note: 'Squash and merge into main as @jordiparra.',
};

const HELD: Briefing = {
  pull: PULLS[1] as Pull,
  head: 'agent/auth-cleanup',
  files: { count: 1, folders: 'in 1 folder', shares: [100, 0] },
  checks: '188 / 188',
  steps: [
    { id: 'checks', label: 'Checks', meta: 'All passing', state: 'done' },
    { id: 'conflicts', label: 'Conflicts', meta: 'Rebase on main', state: 'failed' },
    { id: 'review', label: 'Review', meta: 'Waiting for you', state: 'pending' },
    { id: 'merge', label: 'Merge', meta: 'Squash into main', state: 'pending' },
  ],
  summary: '1 of 4 done',
  note: 'Resolve conflicts with main first.',
};

/**
 * The briefings the spec draws: a pull request that can merge, and one a
 * conflict holds. One composition; the second is only other data.
 */
export function PullRequestBriefingDemo() {
  return (
    <div className="flex w-full flex-col gap-6">
      <BriefingFrame briefing={CLEAN} />
      <BriefingFrame briefing={HELD} />
    </div>
  );
}

function BriefingFrame({ briefing }: { briefing: Briefing }) {
  const { pull } = briefing;
  const [view, setView] = React.useState('briefing');
  const [lane, setLane] = React.useState<Lane>(pull.lane);
  const [verdict, setVerdict] = React.useState('approve');
  const [comment, setComment] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const total = pull.additions + pull.deletions;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl bg-canvas">
      <div className="flex h-14 items-center gap-2 border-b border-border-subtle bg-card px-3">
        <IconButton size="sm" aria-label="Back to the queue">
          <ChevronLeftIcon />
        </IconButton>
        <SegmentedControl size="md" value={view} onValueChange={setView} aria-label="View">
          <SegmentedControlItem value="briefing">Briefing</SegmentedControlItem>
          <SegmentedControlItem value="description">Description</SegmentedControlItem>
          <SegmentedControlItem value="changes">
            Changes
            <DiffStat additions={pull.additions} deletions={pull.deletions} />
          </SegmentedControlItem>
        </SegmentedControl>
        <span className="flex-1" />
        <Button variant="secondary">
          <TerminalIcon />
          Open review session
        </Button>
        <IconButton aria-label="Open on GitHub">
          <SquareArrowOutUpRightIcon />
        </IconButton>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<SubmitReviewButton count={2} />}>Submit review</PopoverTrigger>
          <PopoverContent align="end" className="w-95">
            <ReviewDecision
              verdicts={VERDICTS}
              verdict={verdict}
              onVerdictChange={setVerdict}
              comment={comment}
              onCommentChange={setComment}
              note="2 pending comments, 2 from the full-review agent. Only you can see them until you submit. Posts as @jordiparra."
              submitLabel={SUBMIT[verdict]}
              onSubmit={() => setOpen(false)}
              onDiscard={() => {}}
              onClose={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      {view === 'description' ? (
        <div className="px-8 pt-8 pb-12">
          <Prose className="mx-auto">
            <h1>{pull.title}</h1>
            <h2>Summary</h2>
            <p>
              Replaces the token file with the macOS keychain on the runner and migrates existing tokens on first start. The migration runs once and is
              guarded by an epoch.
            </p>
            <h2>Changes</h2>
            <ul>
              {PR_FILES.map((f) => (
                <li key={f.path}>
                  {f.additions && !f.deletions ? 'Add' : 'Update'} <code>{f.path}</code>
                </li>
              ))}
            </ul>
            <h2>How to test</h2>
            <pre>
              <code>{'pnpm test\ngo test ./runner/...'}</code>
            </pre>
          </Prose>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-245 flex-col gap-4 px-8 pt-8 pb-12">
          <PullRequestHeader
            state="active"
            stateLabel="Open"
            lane={<LaneBadge lane={lane} />}
            reference={pull.reference}
            title={pull.title}
            author={pull.author}
            head={briefing.head}
            base="main"
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Size"
              value={<span className="text-success">+{pull.additions}</span>}
              unit={<span className="figures text-body text-danger">−{pull.deletions}</span>}
              bar={
                <StatBar
                  segments={[
                    { share: Math.round((pull.additions / total) * 100), tone: 'success' },
                    { share: Math.round((pull.deletions / total) * 100), tone: 'danger' },
                  ]}
                />
              }
            />
            <StatCard
              label="Files"
              value={briefing.files.count}
              unit={briefing.files.folders}
              bar={
                <StatBar
                  segments={[
                    { share: briefing.files.shares[0], tone: 'chart-1' },
                    { share: briefing.files.shares[1], tone: 'chart-2' },
                  ]}
                />
              }
            />
            <StatCard
              label="Checks"
              value={briefing.checks}
              unit={<span className="text-success">Passing</span>}
              bar={<StatBar track segments={[{ share: 100, tone: 'success' }]} />}
            />
            <StatCard
              label="Conflicts"
              icon={
                pull.conflicts ? (
                  <span className="flex size-6.5 items-center justify-center self-center rounded-pill bg-danger/12 text-danger">
                    <CircleAlertIcon className="size-3.75" aria-hidden />
                  </span>
                ) : (
                  <span className="flex size-6.5 items-center justify-center self-center rounded-pill bg-success/15 text-success">
                    <CircleCheckIcon className="size-3.75" aria-hidden />
                  </span>
                )
              }
              value={pull.conflicts ? 'Conflicts' : 'None'}
              detail={pull.conflicts ? 'With main · rebase before merging' : 'Merges cleanly into main'}
            />
          </div>
          <MergePath
            title="Path to merge"
            summary={briefing.summary}
            steps={briefing.steps}
            note={briefing.note}
            actions={
              <>
                <Button variant="secondary">
                  <EyeIcon />
                  Review changes
                </Button>
                <MergeButton
                  confirming={confirming}
                  onConfirmingChange={setConfirming}
                  onMerge={() => setConfirming(false)}
                  disabledReason={mergeBlocker(pull)}
                />
              </>
            }
          />
          <Panel title="Brief">
            <p className="m-0 max-w-prose text-body-lg text-pretty text-fg">
              Replaces the token file with the macOS keychain on the runner and migrates existing tokens on first start. The migration runs once and is
              guarded by an epoch.
            </p>
            <ul className="m-0 flex max-w-prose list-disc flex-col gap-2 pl-5 text-body text-fg marker:text-fg-subtle">
              <li>Adds a keychain store on the runner and moves every token read and write behind it.</li>
              <li>Migrates existing tokens from the token file on first start, then deletes the file.</li>
              <li>Guards the migration with an epoch so it runs once, even if the runner restarts mid-way.</li>
            </ul>
            <FactGrid>
              <FactTile label="What changes">Mostly runner/, plus web/</FactTile>
              <FactTile label="Risk">High: auth/ and over 800 lines</FactTile>
              <FactTile label="Review agent">2 findings, both pending</FactTile>
            </FactGrid>
            <div className="flex flex-wrap items-center gap-2.5 border-t border-border-subtle pt-3">
              <span className="text-sm text-fg-muted">Lane</span>
              <span className="flex-1" />
              <SegmentedControl value={lane} onValueChange={(next) => setLane(next as Lane)} aria-label="Lane">
                {(['quick', 'medium', 'deep'] as const).map((l) => (
                  <SegmentedControlItem key={l} value={l}>
                    {LANE_WORD[l]}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
          </Panel>
          <PanelGrid>
            <Panel>
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-pill bg-hover-surface">
                  <TerminalIcon className="size-3.75" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <StatusDot state="running" density="compact">
                    Review session ready
                  </StatusDot>
                  <span className="text-xs text-fg-muted">On mac-studio · {briefing.head} checked out</span>
                </div>
              </div>
              <FactGrid className="grid-cols-2">
                <FactTile label="Checkout built" dot="success" mono>
                  1m 42s
                </FactTile>
                <FactTile label="Affected checks" dot="success" mono>
                  {briefing.checks}
                </FactTile>
              </FactGrid>
              <Button variant="secondary">
                <TerminalIcon />
                Open review session
              </Button>
            </Panel>
            <Panel title="Pending comments" meta="From the review agent">
              <DiffCommentLink path="runner/internal/keychain/keychain.go" line={87}>
                The token file is removed before the keychain writes below are confirmed. A crash between the two loses every token.
              </DiffCommentLink>
              <DiffCommentLink path="web/src/session/reconnect.ts" line={131}>
                Versions are compared as strings, so 0.1.10 sorts before 0.1.8 and falls back to the token file. Use the semver helper.
              </DiffCommentLink>
            </Panel>
            <Panel title="Reviewers">
              <Reviewer initials="JP" name="Jordi Parra" state="needs-input" word="Reviewing" />
              <Reviewer initials="FR" name="Full-review agent" state="completed" word="2 comments" />
            </Panel>
          </PanelGrid>
        </div>
      )}
    </div>
  );
}

function Reviewer({ initials, name, state, word }: { initials: string; name: string; state: StatusState; word: string }) {
  return (
    <div className="flex items-center gap-2.5 text-operate">
      <Avatar size="sm">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 text-fg">{name}</span>
      <StatusDot state={state} density="compact">
        {word}
      </StatusDot>
    </div>
  );
}
