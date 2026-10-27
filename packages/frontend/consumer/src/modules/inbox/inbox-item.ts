import type { AutomationRunEntity } from '../automations/automation.entity';
import type { WorkspaceBotApprovalEntity } from '../bots/bot-conversation.entity';
import type { ProjectEntity } from '../projects/project.entity';
import type { PullRequestEntity } from '../pull-requests/pull-request.entity';
import type { SessionEntity } from '../sessions/session.entity';
import type { InboxMarkEntity } from './inbox-mark.entity';

/**
 * The Inbox (`product/versions/mvp/29-inbox.md`): what needs you, composed
 * from four reads the API already serves. Nothing here is stored but the
 * marks; an item is there while its source says it needs you.
 */
export type InboxItemKind = 'session' | 'approval' | 'pull' | 'run';

/** Why a pull request is in the Inbox: a review asked of you, or yours, ready to merge. */
export type InboxPullReason = 'requested' | 'ready';

interface InboxItemBase {
  /** The occurrence (§3): what a mark is keyed by, so a new wait comes back. */
  key: string;
  /** When the wait began: the list's age, and the order within a rank. */
  since: Date;
  /** Every project the item belongs to; empty is No project. */
  projectIds: readonly string[];
  /** Deprioritized: after everything else, and read as Low. */
  low: boolean;
}

export type InboxItem =
  | (InboxItemBase & { kind: 'session'; session: SessionEntity })
  | (InboxItemBase & { kind: 'approval'; approval: WorkspaceBotApprovalEntity })
  | (InboxItemBase & { kind: 'pull'; pull: PullRequestEntity; reason: InboxPullReason })
  | (InboxItemBase & { kind: 'run'; run: AutomationRunEntity });

/** The four reads, as their hooks answer them. */
export interface InboxSources {
  /** Every unresolved session; those `waiting-on-you` become items. */
  sessions: readonly SessionEntity[];
  /** The workspace's pending approvals across its bots. */
  approvals: readonly WorkspaceBotApprovalEntity[];
  /** `GET /pulls?scope=requested`. */
  requested: readonly PullRequestEntity[];
  /** `GET /pulls?scope=mine`; those with no blocker become items. */
  mine: readonly PullRequestEntity[];
  /** Failed runs of the last day. */
  failedRuns: readonly AutomationRunEntity[];
  projects: readonly ProjectEntity[];
}

export interface InboxSnoozed {
  item: InboxItem;
  until: Date;
}

/** The Inbox at one moment, after the caller's marks. */
export interface InboxView {
  /** What needs you, most blocked first, the deprioritized last. */
  open: InboxItem[];
  /** Marked done and still needing you by its source: the list's Show done. */
  done: InboxItem[];
  /** Hidden until their snooze ends, soonest back first. */
  snoozed: InboxSnoozed[];
}

/**
 * A session's wait: a decision its agent waits on by the decision's id, so a
 * follow-up question is a new item and a mark on the last one never hides it;
 * otherwise a blocked agent by the moment it became blocked
 * (`observedSince`); a failed or stuck launch by its lifecycle's change count,
 * since the API reports no moment a failure began and the next failure is a
 * new change.
 */
export function sessionItemKey(
  session: Pick<SessionEntity, 'id' | 'lifecycle' | 'observedSince' | 'stateSeq' | 'decision'>,
): string {
  if (session.decision) return `session:${session.id}:${session.decision.id}`;
  if (session.lifecycle === 'open' && session.observedSince) {
    return `session:${session.id}:${session.observedSince.toISOString()}`;
  }
  return `session:${session.id}:s${session.stateSeq}`;
}

/**
 * What an occurrence key is an occurrence of: a session (`session:<id>`), a
 * pull request (`pull:<repo>#<number>`), or the approval or run itself,
 * whose key names one wait already. A session's next wait, or a pull
 * request's next push, is the same subject under a new key.
 */
export function inboxSubject(key: string): string {
  if (key.startsWith('session:')) return key.split(':', 2).join(':');
  if (key.startsWith('pull:')) return key.split('@', 1)[0];
  return key;
}

function approvalItemKey(approval: { id: string }): string {
  return `approval:${approval.id}`;
}

/** A pull request by repository, number and head commit: a new push asks again. */
function pullItemKey(pull: Pick<PullRequestEntity, 'githubRepoId' | 'number' | 'headSha'>): string {
  return `pull:${pull.githubRepoId}#${pull.number}@${pull.headSha}`;
}

function runItemKey(run: { id: string }): string {
  return `run:${run.id}`;
}

/** When a session's wait began, as near as its row says. */
function sessionSince(session: SessionEntity): Date {
  if (session.lifecycle === 'open' && session.observedSince) return session.observedSince;
  if (session.lifecycle === 'failed') return session.lastEventAt ?? session.createdAt;
  return session.createdAt;
}

/** The order of §1: approvals and waiting sessions, requested reviews, ready merges, failed runs. */
const RANK: Record<InboxItemKind | 'ready', number> = {
  approval: 0,
  session: 0,
  pull: 1,
  ready: 2,
  run: 3,
};

function rankOf(item: InboxItem): number {
  if (item.kind === 'pull' && item.reason === 'ready') return RANK.ready;
  return RANK[item.kind];
}

/** Most blocked first, oldest wait first within a rank, and every Low item after all of them. */
function compareInboxItems(a: InboxItem, b: InboxItem): number {
  if (a.low !== b.low) return a.low ? 1 : -1;
  const rank = rankOf(a) - rankOf(b);
  if (rank !== 0) return rank;
  const since = a.since.getTime() - b.since.getTime();
  return since !== 0 ? since : a.key.localeCompare(b.key);
}

/**
 * Every item the sources say needs you, before any mark: one per occurrence,
 * each with its projects (§1, Project).
 */
function inboxItems(sources: InboxSources): InboxItem[] {
  const placed = new Set(
    sources.projects.filter((project) => !project.isUnassigned).map((project) => project.id),
  );
  const projectOf = (id: string | null | undefined): string[] => (id && placed.has(id) ? [id] : []);
  const sessionProject = new Map(
    sources.sessions.map((session) => [session.id, session.projectId]),
  );
  const holders = (githubRepoId: number): string[] =>
    sources.projects
      .filter(
        (project) =>
          !project.isUnassigned &&
          project.repositories.some(
            (repository) => repository.githubRepoId === String(githubRepoId),
          ),
      )
      .map((project) => project.id);

  const items: InboxItem[] = [];
  for (const session of sources.sessions) {
    if (session.state !== 'waiting-on-you') continue;
    items.push({
      kind: 'session',
      session,
      key: sessionItemKey(session),
      since: sessionSince(session),
      projectIds: projectOf(session.projectId),
      low: false,
    });
  }
  for (const approval of sources.approvals) {
    if (!approval.isPending) continue;
    const concerns = approval.concernsSessionId;
    items.push({
      kind: 'approval',
      approval,
      key: approvalItemKey(approval),
      since: approval.createdAt,
      projectIds: projectOf(concerns ? sessionProject.get(concerns) : null),
      low: false,
    });
  }
  const pulls = [
    ...sources.requested
      .filter((pull) => pull.scope === 'requested')
      .map((pull) => ({ pull, reason: 'requested' as const })),
    ...sources.mine
      .filter((pull) => pull.scope === 'mine' && pull.blocker === null)
      .map((pull) => ({ pull, reason: 'ready' as const })),
  ];
  for (const { pull, reason } of pulls) {
    items.push({
      kind: 'pull',
      pull,
      reason,
      key: pullItemKey(pull),
      since: pull.openedAt,
      projectIds: holders(pull.githubRepoId),
      low: false,
    });
  }
  for (const run of sources.failedRuns) {
    if (run.status !== 'failed') continue;
    items.push({
      kind: 'run',
      run,
      key: runItemKey(run),
      since: run.endedAt ?? run.createdAt,
      projectIds: projectOf(run.projectId),
      low: false,
    });
  }
  // One row per occurrence, whichever read named it first.
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.key) && seen.add(item.key));
}

/**
 * The Inbox after the caller's marks (§3): done and deleted hide, done
 * staying under Show done; a snooze hides until it ends and lists in
 * Snoozed; low sorts last. A mark whose occurrence no source names is
 * never read. `answered` are occurrences answered here whose source has not
 * caught up yet: gone from every list, so each count agrees with them.
 */
export function composeInbox(
  sources: InboxSources,
  marks: readonly InboxMarkEntity[],
  now: number,
  answered: ReadonlySet<string> = new Set(),
): InboxView {
  const byKey = new Map(
    marks.filter((mark) => mark.inForce(now)).map((mark) => [mark.itemKey, mark]),
  );
  const view: InboxView = { open: [], done: [], snoozed: [] };
  for (const item of inboxItems(sources)) {
    if (answered.has(item.key)) continue;
    const mark = byKey.get(item.key);
    switch (mark?.mark) {
      case 'deleted':
        break;
      case 'done':
        view.done.push(item);
        break;
      case 'snoozed':
        if (mark.until) view.snoozed.push({ item, until: mark.until });
        break;
      case 'low':
        view.open.push({ ...item, low: true });
        break;
      default:
        view.open.push(item);
    }
  }
  view.open.sort(compareInboxItems);
  view.done.sort(compareInboxItems);
  view.snoozed.sort((a, b) => a.until.getTime() - b.until.getTime());
  return view;
}
