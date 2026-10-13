'use client';

import { Badge } from '@oppenheimer/design-system-web/badge';
import { Button } from '@oppenheimer/design-system-web/button';
import { Card, CardContent } from '@oppenheimer/design-system-web/card';
import { ChipSelect } from '@oppenheimer/design-system-web/chip-select';
import { DiffStat } from '@oppenheimer/design-system-web/diff-stat';
import { FacetSelect } from '@oppenheimer/design-system-web/facet-select';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  EyeIcon,
  FileTextIcon,
  GitBranchIcon,
  SearchIcon,
  SquareArrowOutUpRightIcon,
} from '@oppenheimer/design-system-web/icons';
import { Kbd } from '@oppenheimer/design-system-web/kbd';
import { MergePath } from '@oppenheimer/design-system-web/merge-path';
import { PageHeader, PageHeaderMeta, PageHeaderRow, PageHeaderSep, PageHeaderStat } from '@oppenheimer/design-system-web/page-header';
import { Popover, PopoverContent, PopoverTrigger } from '@oppenheimer/design-system-web/popover';
import { Prose } from '@oppenheimer/design-system-web/prose';
import { PullRequestHeader } from '@oppenheimer/design-system-web/pull-request-header';
import { MergeButton, PullRequestRow, PullRequestTable, PullRequestTableHead } from '@oppenheimer/design-system-web/pull-request-table';
import { ReviewDecision, SubmitReviewButton } from '@oppenheimer/design-system-web/review-decision';
import { RunsListFoot } from '@oppenheimer/design-system-web/runs-list';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import type { StatusState } from '@oppenheimer/design-system-web/status-dot';
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

const REPOSITORIES = ['all', 'oppenheimer', 'runner', 'docs'] as const;

function repositoryOf(pull: Pull): string {
  return pull.reference.split(' ')[0] ?? '';
}

function LaneBadge({ lane }: { lane: Lane }) {
  return <Badge variant={lane === 'deep' ? 'strong' : 'soft'}>{LANE_WORD[lane]}</Badge>;
}

/**
 * The queue: the page's display header and its one primary action, the
 * scopes, then the table with its search, the repository picker and the
 * Difficulty, Checks and Waiting facets, rows that merge in place after one
 * confirm, and the paged foot. The order is fixed: Deep first, then the
 * longest wait.
 */
export function PullRequestQueueDemo() {
  const [scope, setScope] = React.useState('mine');
  const [lane, setLane] = React.useState<'all' | Lane>('all');
  const [checks, setChecks] = React.useState('any');
  const [repository, setRepository] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<number | null>(null);
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const [merged, setMerged] = React.useState<number[]>([485]);
  const term = query.trim().toLowerCase();
  const rows = PULLS.filter(
    (p) =>
      (lane === 'all' || p.lane === lane) &&
      (checks === 'any' || p.checks === checks) &&
      (repository === 'all' || repositoryOf(p) === repository) &&
      (!term || `${p.title} ${p.reference} ${p.author}`.toLowerCase().includes(term)),
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
          Opened by you or your sessions.
        </p>
      </div>
      <PullRequestTable>
        <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-2">
          <label className="flex h-8.5 w-65 items-center gap-2 rounded-pill bg-hover-surface px-3 text-fg-subtle">
            <SearchIcon className="size-3.5" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, repo, #number, author"
              aria-label="Search pull requests"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <ChipSelect
            aria-label="Repository"
            icon={<GitBranchIcon />}
            value={repository}
            onValueChange={setRepository}
            options={REPOSITORIES.map((name) => ({
              value: name,
              label: name === 'all' ? 'All repositories' : name,
              mono: name !== 'all',
              count: name === 'all' ? PULLS.length : PULLS.filter((p) => repositoryOf(p) === name).length,
            }))}
            searchPlaceholder="Search repositories"
            emptyText="No repository matches."
          />
          <span className="flex-1" />
          <FacetSelect
            label="Difficulty"
            value={lane}
            onValueChange={(next) => setLane(next as typeof lane)}
            options={[
              { value: 'all', label: 'All', count: PULLS.length },
              ...(['deep', 'medium', 'quick'] as const).map((l) => ({ value: l, label: LANE_WORD[l], count: count(l) })),
            ]}
          />
          <FacetSelect
            label="Checks"
            value={checks}
            onValueChange={setChecks}
            options={[
              { value: 'any', label: 'Any', count: PULLS.length },
              ...(['passing', 'failing', 'running'] as const).map((c) => ({
                value: c,
                label: CHECK_WORD[c],
                count: PULLS.filter((p) => p.checks === c).length,
              })),
            ]}
          />
          <FacetSelect
            label="Waiting"
            value="any"
            onValueChange={() => {}}
            options={[
              { value: 'any', label: 'Any time', count: PULLS.length },
              { value: 'hour', label: 'Under 1h', count: 1 },
              { value: 'day', label: '1h – 1 day', count: 5 },
              { value: 'older', label: 'Over 1 day', count: 1 },
            ]}
          />
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
                  <EyeIcon />
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
  { value: 'approve', label: 'Approve', description: 'Approves as you. You merge it later.' },
  { value: 'approve_and_merge', label: 'Approve and merge', description: 'Approves as you and merges once required checks pass.' },
  { value: 'changes', label: 'Request changes', description: 'Sends your comments back to the session to fix.' },
];
const SUBMIT: Record<string, string> = {
  comment: 'Comment',
  approve: 'Approve',
  approve_and_merge: 'Approve and merge',
  changes: 'Request changes',
};

/** What the Description tab shows for one pull request, besides the queue's row. */
interface Description {
  pull: Pull;
  head: string;
  files: string;
  steps: Step[];
}

const CLEAN: Description = {
  pull: PULLS[0] as Pull,
  head: 'agent/auth-keychain',
  files: '4 files in 2 folders',
  steps: [
    { id: 'checks', label: 'Checks', meta: 'All passing', state: 'done' },
    { id: 'conflicts', label: 'Conflicts', meta: 'Merges cleanly', state: 'done' },
    { id: 'merge', label: 'Merge', meta: 'Squash into main', state: 'pending' },
  ],
};

const HELD: Description = {
  pull: PULLS[1] as Pull,
  head: 'agent/auth-cleanup',
  files: '1 file in 1 folder',
  steps: [
    { id: 'checks', label: 'Checks', meta: 'All passing', state: 'done' },
    { id: 'conflicts', label: 'Conflicts', meta: 'Rebase on main', state: 'failed' },
    { id: 'merge', label: 'Merge', meta: 'Resolve conflicts with main first', state: 'running' },
  ],
};

/**
 * A pull request opened on its Description, as the spec draws it: one that
 * can merge, and one a conflict holds. One composition; the second is only
 * other data.
 */
export function PullRequestDescriptionDemo() {
  return (
    <div className="flex w-full flex-col gap-6">
      <DescriptionFrame description={CLEAN} />
      <DescriptionFrame description={HELD} />
    </div>
  );
}

function DescriptionFrame({ description }: { description: Description }) {
  const { pull } = description;
  const [view, setView] = React.useState('description');
  const [verdict, setVerdict] = React.useState('approve');
  const [comment, setComment] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl bg-canvas">
      <div className="flex h-14 items-center gap-2 border-b border-border-subtle bg-card px-3">
        <IconButton size="sm" aria-label="Back to the queue">
          <ChevronLeftIcon />
        </IconButton>
        <SegmentedControl size="md" value={view} onValueChange={setView} aria-label="View">
          <SegmentedControlItem value="description">Description</SegmentedControlItem>
          <SegmentedControlItem value="changes">
            Changes
            <DiffStat additions={pull.additions} deletions={pull.deletions} />
          </SegmentedControlItem>
        </SegmentedControl>
        <span className="flex-1" />
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
              note="2 pending comments. Only you can see them until you submit. Posts as @jordiparra."
              submitLabel={SUBMIT[verdict]}
              onSubmit={() => setOpen(false)}
              onDiscard={() => {}}
              onClose={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="mx-auto flex w-full max-w-245 flex-col gap-4 px-8 pt-8 pb-12">
        <PullRequestHeader
          state="active"
          stateLabel="Open"
          reference={pull.reference}
          title={pull.title}
          author={pull.author}
          head={description.head}
          base="main"
        />
        <MergePath
          leading={
            <>
              <DiffStat additions={pull.additions} deletions={pull.deletions} />
              <span>{description.files}</span>
            </>
          }
          steps={description.steps}
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
        <Card>
          <CardContent>
            <Prose>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
