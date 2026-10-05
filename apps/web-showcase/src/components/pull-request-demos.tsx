'use client';

import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Button } from '@oppenheimer/design-system-web/button';
import { DiffCommentLink } from '@oppenheimer/design-system-web/diff-view';
import { DiffStat } from '@oppenheimer/design-system-web/diff-stat';
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
import {
  LaneBadge,
  MergeButton,
  type PullRequestCheck,
  type PullRequestConflict,
  type PullRequestLane,
  PullRequestRow,
  PullRequestTable,
  PullRequestTableHead,
} from '@oppenheimer/design-system-web/pull-request-table';
import { ReviewDecision, SubmitReviewButton } from '@oppenheimer/design-system-web/review-decision';
import { RunsListFoot } from '@oppenheimer/design-system-web/runs-list';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import { FactGrid, FactTile, StatBar, StatCard } from '@oppenheimer/design-system-web/stat-card';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';
import * as React from 'react';

import { PR_FILES } from './pull-request-fixtures';

interface QueueRow {
  id: number;
  lane: PullRequestLane;
  title: string;
  reference: string;
  author: string;
  person?: boolean;
  note?: string;
  noteTone?: 'danger' | 'warning';
  additions: number;
  deletions: number;
  checks: PullRequestCheck;
  conflicts: PullRequestConflict;
  waiting: string;
  late?: boolean;
  merged?: boolean;
}

const ROWS: QueueRow[] = [
  { id: 482, lane: 'deep', title: 'Move session tokens to the runner keychain', reference: 'oppenheimer #482', author: 'Session · auth-hardening', additions: 612, deletions: 248, checks: 'passing', conflicts: 'clean', waiting: '1d 3h', late: true },
  { id: 135, lane: 'deep', title: 'Drop the legacy token file reader', reference: 'runner #135', author: 'Session · auth-cleanup', additions: 58, deletions: 310, checks: 'passing', conflicts: 'conflicts', waiting: '18h 24m', late: true },
  { id: 134, lane: 'medium', title: 'Retry host registration with backoff', reference: 'runner #134', author: 'Session · host-retry', additions: 96, deletions: 22, checks: 'passing', conflicts: 'clean', waiting: '7h 30m' },
  { id: 492, lane: 'medium', title: 'Group sessions by project in search results', reference: 'oppenheimer #492', author: 'Session · search-groups', note: 'Checks failing', noteTone: 'danger', additions: 176, deletions: 31, checks: 'failing', conflicts: 'clean', waiting: '4h 48m' },
  { id: 131, lane: 'medium', title: 'Report disk pressure above 90%', reference: 'runner #131', author: 'Session · disk-pressure', note: 'Checks running', additions: 118, deletions: 7, checks: 'running', conflicts: 'clean', waiting: '1h 24m' },
  { id: 57, lane: 'quick', title: 'Document the review lanes', reference: 'docs #57', author: 'Pau Serra', person: true, additions: 142, deletions: 3, checks: 'passing', conflicts: 'clean', waiting: '36m' },
  { id: 474, lane: 'quick', title: 'Bump vite to 6.3.2', reference: 'oppenheimer #474', author: 'Session · deps', note: 'Waiting · needs a code owner', noteTone: 'warning', additions: 18, deletions: 18, checks: 'passing', conflicts: 'clean', waiting: '5h 48m' },
  { id: 485, lane: 'quick', title: 'Fix typos in session empty states', reference: 'oppenheimer #485', author: 'Session · copy-pass', note: 'Merged 10:42', additions: 6, deletions: 6, checks: 'passing', conflicts: 'clean', waiting: '—', merged: true },
];

const LANE_WORD: Record<PullRequestLane, string> = { deep: 'Deep', medium: 'Medium', quick: 'Quick' };
const CHECK_WORD: Record<PullRequestCheck, string> = { passing: 'Passing', failing: 'Failing', running: 'Running', none: 'No checks' };
const CONFLICT_WORD: Record<PullRequestConflict, string> = { clean: 'No conflicts', conflicts: 'Conflicts' };

/**
 * The queue: the page's display header and its one primary action, the
 * scopes, then the table with its search and lane filters, rows that merge
 * in place after one confirm, and the paged foot.
 */
export function PullRequestQueueDemo() {
  const [scope, setScope] = React.useState('mine');
  const [lane, setLane] = React.useState<'all' | PullRequestLane>('all');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<number | null>(null);
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const [merged, setMerged] = React.useState<number[]>([485]);
  const term = query.trim().toLowerCase();
  const rows = ROWS.filter(
    (r) =>
      (lane === 'all' || r.lane === lane) &&
      (!term || `${r.title} ${r.reference} ${r.author}`.toLowerCase().includes(term)),
  );
  const count = (l: PullRequestLane) => ROWS.filter((r) => r.lane === l).length;

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
            <PillTab value="all" count={ROWS.length}>
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
        {rows.map((r) => (
          <PullRequestRow
            key={r.id}
            lane={<LaneBadge lane={r.lane}>{LANE_WORD[r.lane]}</LaneBadge>}
            title={r.title}
            reference={r.reference}
            author={r.author}
            authorKind={r.person ? 'person' : 'session'}
            note={r.note}
            noteTone={r.noteTone}
            additions={r.additions}
            deletions={r.deletions}
            checks={r.checks}
            checksLabel={CHECK_WORD[r.checks]}
            conflicts={r.conflicts}
            conflictsLabel={CONFLICT_WORD[r.conflicts]}
            waiting={r.waiting}
            waitingTone={r.late ? 'late' : undefined}
            selected={selected === r.id}
            onOpen={() => setSelected(r.id)}
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
                  merged={merged.includes(r.id)}
                  confirming={confirming === r.id}
                  onConfirmingChange={(next) => setConfirming(next ? r.id : null)}
                  onMerge={() => {
                    setMerged((m) => [...m, r.id]);
                    setConfirming(null);
                  }}
                  disabledReason={
                    r.conflicts === 'conflicts'
                      ? 'Resolve conflicts with main first'
                      : r.checks !== 'passing'
                        ? 'Waiting on checks'
                        : r.noteTone === 'warning'
                          ? 'Needs a code owner'
                          : undefined
                  }
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
  { value: 'changes', label: 'Request changes', description: 'Sends your comments back to the auth-hardening session to fix.' },
];
const SUBMIT: Record<string, string> = { comment: 'Comment', approve: 'Approve and merge', changes: 'Request changes' };

/**
 * One pull request opened on its briefing: the bar with the views and the
 * review's two actions (Submit review opens the decision), the header, the
 * four numbers, the path to merge, the brief with its facts and lane, the
 * review session and the pending comments, where it changes and who
 * reviews. `conflicted` shows the same page held by a conflict.
 */
export function PullRequestBriefingDemo({ conflicted = false }: { conflicted?: boolean }) {
  const [view, setView] = React.useState('briefing');
  const [lane, setLane] = React.useState<PullRequestLane>('deep');
  const [verdict, setVerdict] = React.useState('approve');
  const [comment, setComment] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const dirs = [
    { name: 'runner/internal/keychain', files: '2 files', additions: 554, deletions: 40, share: 64, tone: 'primary' as const },
    { name: 'runner/internal/tokens', files: '1 file', additions: 0, deletions: 96, share: 11, tone: 'teal' as const },
    { name: 'web/src/session', files: '1 file', additions: 58, deletions: 112, share: 25, tone: 'muted' as const },
  ];

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
            <DiffStat additions={612} deletions={248} />
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
            <h1>Move session tokens to the runner keychain</h1>
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
            <h2>Notes</h2>
            <p>Opened by the auth-hardening session. Changes requested here are sent back to the session.</p>
          </Prose>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-245 flex-col gap-4 px-8 pt-8 pb-12">
          <PullRequestHeader
            state="open"
            stateLabel="Open"
            lane={<LaneBadge lane={lane}>{LANE_WORD[lane]}</LaneBadge>}
            reference={conflicted ? 'runner #135' : 'oppenheimer #482'}
            title={conflicted ? 'Drop the legacy token file reader' : 'Move session tokens to the runner keychain'}
            author={conflicted ? 'Session · auth-cleanup' : 'Session · auth-hardening'}
            head={conflicted ? 'agent/auth-cleanup' : 'agent/auth-keychain'}
            base="main"
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Size"
              value={<span className="text-success">+{conflicted ? 58 : 612}</span>}
              unit={<span className="figures text-body text-danger">−{conflicted ? 310 : 248}</span>}
              bar={
                <StatBar
                  segments={[
                    { share: conflicted ? 16 : 71, tone: 'success' },
                    { share: conflicted ? 84 : 29, tone: 'danger' },
                  ]}
                />
              }
            />
            <StatCard
              label="Files"
              value={conflicted ? 1 : 4}
              unit={conflicted ? 'in 1 folder' : 'in 2 folders'}
              bar={
                <StatBar
                  segments={[
                    { share: 75, tone: 'primary' },
                    { share: 25, tone: 'teal' },
                  ]}
                />
              }
            />
            <StatCard
              label="Checks"
              value="214 / 214"
              unit={<span className="text-success">Passing</span>}
              bar={<StatBar track segments={[{ share: 100, tone: 'success' }]} />}
            />
            <StatCard
              label="Conflicts"
              icon={
                conflicted ? (
                  <span className="flex size-6.5 items-center justify-center self-center rounded-pill bg-danger/12 text-danger">
                    <CircleAlertIcon className="size-3.75" aria-hidden />
                  </span>
                ) : (
                  <span className="flex size-6.5 items-center justify-center self-center rounded-pill bg-success/15 text-success">
                    <CircleCheckIcon className="size-3.75" aria-hidden />
                  </span>
                )
              }
              value={conflicted ? 'Conflicts' : 'None'}
              detail={conflicted ? 'With main · rebase before merging' : 'Merges cleanly into main'}
            />
          </div>
          <MergePath
            title="Path to merge"
            summary={conflicted ? '1 of 4 done' : '2 of 4 done'}
            steps={[
              { label: 'Checks', detail: 'All passing', state: 'done' },
              conflicted
                ? { label: 'Conflicts', detail: 'Rebase on main', state: 'blocked' }
                : { label: 'Conflicts', detail: 'Merges cleanly', state: 'done' },
              { label: 'Review', detail: conflicted ? 'Waiting for you' : '2 pending comments', state: 'pending' },
              { label: 'Merge', detail: 'Squash into main', state: 'pending' },
            ]}
            note={conflicted ? 'Resolve conflicts with main first.' : 'Squash and merge into main as @jordiparra.'}
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
                  disabledReason={conflicted ? 'Resolve conflicts with main first' : undefined}
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
              <SegmentedControl value={lane} onValueChange={(next) => setLane(next as PullRequestLane)} aria-label="Lane">
                {(['quick', 'medium', 'deep'] as const).map((l) => (
                  <SegmentedControlItem key={l} value={l}>
                    {LANE_WORD[l]}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
            <span className="text-sm text-fg-muted">Deep by policy: touches auth/ and changes 860 lines.</span>
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
                  <span className="text-xs text-fg-muted">On mac-studio · agent/auth-keychain checked out</span>
                </div>
              </div>
              <FactGrid className="grid-cols-2">
                <FactTile label="Checkout built" dot="success" mono>
                  1m 42s
                </FactTile>
                <FactTile label="Affected checks" dot="success" mono>
                  214 / 214
                </FactTile>
                <FactTile label="App started" dot="success" mono>
                  localhost:5173
                </FactTile>
                <FactTile label="Context pack" dot="success" mono>
                  9 callers · 3 rules
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
            <Panel title="Where it changes" meta={<span className="figures">860 lines</span>}>
              <StatBar className="h-2.5" segments={dirs.map((d) => ({ share: d.share, tone: d.tone, label: d.name }))} />
              <div className="flex flex-col">
                {dirs.map((d) => (
                  <div key={d.name} className="flex min-h-9 items-center gap-2.5">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="figures truncate text-xs text-fg">{d.name}</span>
                      <span className="text-xs whitespace-nowrap text-fg-subtle">{d.files}</span>
                    </span>
                    <DiffStat additions={d.additions} deletions={d.deletions} />
                    <span className="figures w-11 text-right text-xs text-fg-muted">{d.share}%</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Reviewers">
              {[
                ['JP', 'Jordi Parra', 'needs-input', 'Reviewing'],
                ['FR', 'Full-review agent', 'running', '2 comments'],
              ].map(([initials, name, state, word]) => (
                <div key={name} className="flex items-center gap-2.5 text-operate">
                  <Avatar size="sm">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 text-fg">{name}</span>
                  <StatusDot state={state as 'running'} density="compact">
                    {word}
                  </StatusDot>
                </div>
              ))}
            </Panel>
          </PanelGrid>
        </div>
      )}
    </div>
  );
}
