import type { GithubEventType } from '@oppenheimer/shared/automations';
import {
  EXTERNAL_CONTEXT_BODY_MAX,
  type ExternalEvent,
  type ExternalEventContext,
  type InboundDelivery,
} from '../../inbound-events/domain/external-event.types';

/**
 * GitHub webhook deliveries → the trigger catalog's events
 * (`product/versions/mvp/16-automations-architecture.md` §Q6).
 *
 * Pure: a delivery always normalizes the same way, which is what makes the
 * hub's re-processing safe. Each mapping below is the frames' description of
 * the event, as GitHub delivers it:
 *
 * | Catalog         | GitHub                                                        |
 * |-----------------|---------------------------------------------------------------|
 * | `pr_opened`     | `pull_request` `opened` (not a draft), `ready_for_review`      |
 * | `pr_draft`      | `pull_request` `opened` as a draft, `converted_to_draft`       |
 * | `pr_sync`       | `pull_request` `synchronize`                                   |
 * | `pr_merged`     | `pull_request` `closed` with `merged: true`                    |
 * | `comment`       | `issue_comment` / `pull_request_review_comment` `created`      |
 * | `mention`       | any of those, or a submitted review, whose body mentions us    |
 * | `push`          | `push` to a branch, not a tag and not a branch deletion        |
 * | `issue_labeled` | `issues` / `pull_request` `labeled`, one event per label       |
 * | `check_failed`  | `check_suite` completed failing, or a `status` of failure      |
 * | `issue_opened`  | `issues` `opened` (reopened is a different action)             |
 * | `release`       | `release` `published`, pre-releases excluded                   |
 *
 * `check_suite` rather than `check_run`: one suite per app per commit, where a
 * workflow with twenty jobs is twenty runs — "Check failed" would otherwise
 * start twenty sessions for one red commit.
 */
export const GITHUB_WEBHOOK_EVENTS = [
  'pull_request',
  'issues',
  'issue_comment',
  'pull_request_review',
  'pull_request_review_comment',
  'push',
  'check_suite',
  'status',
  'release',
] as const;

export interface GithubNormalizerOptions {
  /** The App's slug: its bot is `<slug>[bot]`, and its events are our own. */
  appSlug?: string;
  /** The handle a mention names, without the `@`. */
  mentionHandle: string;
}

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function capped(value: unknown): string | undefined {
  const text = str(value);
  if (!text) return undefined;
  if (text.length <= EXTERNAL_CONTEXT_BODY_MAX) return text;
  return `${text.slice(0, EXTERNAL_CONTEXT_BODY_MAX)}\n[truncated; read the full text with gh]`;
}

function dateOf(...candidates: unknown[]): Date | null {
  for (const candidate of candidates) {
    const text = str(candidate);
    if (!text) continue;
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function branchOfRef(ref: unknown): string | null {
  const text = str(ref);
  return text?.startsWith('refs/heads/') ? text.slice('refs/heads/'.length) : null;
}

export function isOwnAppActor(sender: Json, options: GithubNormalizerOptions): boolean {
  if (!options.appSlug) return false;
  return sender.type === 'Bot' && sender.login === `${options.appSlug}[bot]`;
}

export function mentions(body: unknown, handle: string): boolean {
  const text = str(body);
  if (!text || !handle) return false;
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w/])@${escaped}(?![\\w-])`, 'i').test(text);
}

/** Normalize one verified GitHub delivery into zero or more catalog events. */
export function normalizeGithubDelivery(
  delivery: Pick<InboundDelivery, 'deliveryId' | 'eventName' | 'payload' | 'receivedAt'>,
  options: GithubNormalizerOptions,
): ExternalEvent[] {
  const payload = delivery.payload;
  const repository = obj(payload.repository);
  const repoId = num(repository.id);
  const repoName = str(repository.full_name);
  if (repoId === null || !repoName) return [];
  const sender = obj(payload.sender);
  const action = str(payload.action);

  const make = (
    type: GithubEventType,
    attributes: ExternalEvent['attributes'],
    context: ExternalEventContext,
    occurredAt: Date | null,
    suffix = '',
  ): ExternalEvent => ({
    source: 'github',
    type,
    externalId: `${delivery.deliveryId}:${type}${suffix}`,
    subject: { kind: 'repository', ref: String(repoId), name: repoName },
    actor: { login: str(sender.login), isOwnApp: isOwnAppActor(sender, options) },
    attributes,
    context: { repository: repoName, ...context },
    occurredAt: occurredAt ?? delivery.receivedAt,
    schemaVersion: 1,
  });

  switch (delivery.eventName) {
    case 'pull_request':
      return pullRequestEvents(payload, action, make);
    case 'issues':
      return issueEvents(payload, action, make);
    case 'issue_comment':
    case 'pull_request_review_comment':
      return commentEvents(payload, action, options, make);
    case 'pull_request_review':
      return reviewEvents(payload, action, options, make);
    case 'push':
      return pushEvents(payload, make);
    case 'check_suite':
      return checkSuiteEvents(payload, action, make);
    case 'status':
      return statusEvents(payload, make);
    case 'release':
      return releaseEvents(payload, action, make);
    default:
      return [];
  }
}

type Make = (
  type: GithubEventType,
  attributes: ExternalEvent['attributes'],
  context: ExternalEventContext,
  occurredAt: Date | null,
  suffix?: string,
) => ExternalEvent;

function pullRequestParts(pr: Json) {
  const base = obj(pr.base);
  const head = obj(pr.head);
  const headRepo = obj(head.repo);
  const baseRepo = obj(base.repo);
  const number = num(pr.number);
  const fork =
    Boolean(headRepo.fork) || (str(headRepo.full_name) ?? '') !== (str(baseRepo.full_name) ?? '');
  return {
    attributes: {
      baseBranch: str(base.ref),
      branch: str(head.ref),
      number,
      headSha: str(head.sha),
      draft: Boolean(pr.draft),
      fork,
    },
    context: {
      ref: number === null ? undefined : `#${number}`,
      title: capped(pr.title),
      body: capped(pr.body),
      url: str(pr.html_url) ?? undefined,
      author: str(obj(pr.user).login) ?? undefined,
      baseBranch: str(base.ref) ?? undefined,
      headBranch: str(head.ref) ?? undefined,
    } satisfies ExternalEventContext,
  };
}

function pullRequestEvents(payload: Json, action: string | null, make: Make): ExternalEvent[] {
  const pr = obj(payload.pull_request);
  const { attributes, context } = pullRequestParts(pr);
  switch (action) {
    case 'opened':
      return [
        make(pr.draft ? 'pr_draft' : 'pr_opened', attributes, context, dateOf(pr.created_at)),
      ];
    case 'ready_for_review':
      return [make('pr_opened', attributes, context, dateOf(pr.updated_at))];
    case 'converted_to_draft':
      return [make('pr_draft', attributes, context, dateOf(pr.updated_at))];
    case 'synchronize':
      return [make('pr_sync', attributes, context, dateOf(pr.updated_at))];
    case 'closed':
      return pr.merged ? [make('pr_merged', attributes, context, dateOf(pr.merged_at))] : [];
    case 'labeled': {
      const label = str(obj(payload.label).name);
      if (!label) return [];
      return [
        make(
          'issue_labeled',
          { ...attributes, label },
          { ...context, label },
          dateOf(pr.updated_at),
          `:${label}`,
        ),
      ];
    }
    default:
      return [];
  }
}

function issueParts(issue: Json) {
  const number = num(issue.number);
  return {
    attributes: { number, isPullRequest: issue.pull_request !== undefined },
    context: {
      ref: number === null ? undefined : `#${number}`,
      title: capped(issue.title),
      body: capped(issue.body),
      url: str(issue.html_url) ?? undefined,
      author: str(obj(issue.user).login) ?? undefined,
    } satisfies ExternalEventContext,
  };
}

function issueEvents(payload: Json, action: string | null, make: Make): ExternalEvent[] {
  const issue = obj(payload.issue);
  const { attributes, context } = issueParts(issue);
  if (action === 'opened')
    return [make('issue_opened', attributes, context, dateOf(issue.created_at))];
  if (action === 'labeled') {
    const label = str(obj(payload.label).name);
    if (!label) return [];
    return [
      make(
        'issue_labeled',
        { ...attributes, label },
        { ...context, label },
        dateOf(issue.updated_at),
        `:${label}`,
      ),
    ];
  }
  return [];
}

function commentEvents(
  payload: Json,
  action: string | null,
  options: GithubNormalizerOptions,
  make: Make,
): ExternalEvent[] {
  if (action !== 'created') return [];
  const comment = obj(payload.comment);
  const parent = obj(payload.issue ?? payload.pull_request);
  const number = num(parent.number);
  const context: ExternalEventContext = {
    ref: number === null ? undefined : `#${number}`,
    title: capped(parent.title),
    body: capped(comment.body),
    url: str(comment.html_url) ?? undefined,
    author: str(obj(comment.user).login) ?? undefined,
  };
  const attributes = { number, commentId: num(comment.id) };
  const at = dateOf(comment.created_at);
  const events = [make('comment', attributes, context, at)];
  if (mentions(comment.body, options.mentionHandle)) {
    events.push(make('mention', attributes, context, at));
  }
  return events;
}

function reviewEvents(
  payload: Json,
  action: string | null,
  options: GithubNormalizerOptions,
  make: Make,
): ExternalEvent[] {
  if (action !== 'submitted') return [];
  const review = obj(payload.review);
  if (!mentions(review.body, options.mentionHandle)) return [];
  const pr = obj(payload.pull_request);
  const { attributes, context } = pullRequestParts(pr);
  return [
    make(
      'mention',
      attributes,
      { ...context, body: capped(review.body), url: str(review.html_url) ?? context.url },
      dateOf(review.submitted_at),
    ),
  ];
}

function pushEvents(payload: Json, make: Make): ExternalEvent[] {
  if (payload.deleted === true) return [];
  const branch = branchOfRef(payload.ref);
  if (!branch) return []; // a tag
  const head = obj(payload.head_commit);
  const after = str(payload.after);
  const commits = Array.isArray(payload.commits) ? payload.commits.length : 0;
  return [
    make(
      'push',
      { branch, headSha: after, commits, forced: Boolean(payload.forced) },
      {
        ref: after ? after.slice(0, 7) : undefined,
        title: capped(head.message),
        url: str(payload.compare) ?? undefined,
        author: str(obj(payload.pusher).name) ?? undefined,
        branch,
      },
      dateOf(head.timestamp),
    ),
  ];
}

const FAILING_CONCLUSIONS = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);

function checkSuiteEvents(payload: Json, action: string | null, make: Make): ExternalEvent[] {
  if (action !== 'completed') return [];
  const suite = obj(payload.check_suite);
  const conclusion = str(suite.conclusion);
  if (!conclusion || !FAILING_CONCLUSIONS.has(conclusion)) return [];
  const branch = str(suite.head_branch);
  const app = obj(suite.app);
  const pulls = Array.isArray(suite.pull_requests) ? suite.pull_requests.map(obj) : [];
  const number = pulls.length > 0 ? num(pulls[0].number) : null;
  const headSha = str(suite.head_sha);
  return [
    make(
      'check_failed',
      { branch, headSha, conclusion, number, check: str(app.name) },
      {
        ref: str(app.name) ?? (headSha ? headSha.slice(0, 7) : undefined),
        title: `${str(app.name) ?? 'A check'} ${conclusion.replace('_', ' ')} on ${branch ?? headSha ?? 'a commit'}`,
        url: str(suite.url) ?? undefined,
        branch: branch ?? undefined,
        pullRequest: number === null ? undefined : `#${number}`,
      },
      dateOf(suite.updated_at),
      `:${str(suite.id) ?? num(suite.id) ?? ''}`,
    ),
  ];
}

function statusEvents(payload: Json, make: Make): ExternalEvent[] {
  const state = str(payload.state);
  if (state !== 'failure' && state !== 'error') return [];
  const branches = Array.isArray(payload.branches) ? payload.branches.map(obj) : [];
  const branch = branches.length > 0 ? str(branches[0].name) : null;
  const sha = str(payload.sha);
  const contextName = str(payload.context);
  return [
    make(
      'check_failed',
      { branch, headSha: sha, conclusion: state, number: null, check: contextName },
      {
        ref: contextName ?? (sha ? sha.slice(0, 7) : undefined),
        title: capped(payload.description) ?? `${contextName ?? 'A status'} ${state}`,
        url: str(payload.target_url) ?? undefined,
        branch: branch ?? undefined,
      },
      dateOf(payload.updated_at, payload.created_at),
      `:${contextName ?? ''}`,
    ),
  ];
}

function releaseEvents(payload: Json, action: string | null, make: Make): ExternalEvent[] {
  if (action !== 'published') return [];
  const release = obj(payload.release);
  if (release.prerelease === true) return [];
  const tag = str(release.tag_name);
  return [
    make(
      'release',
      { tag },
      {
        ref: tag ?? undefined,
        title: capped(release.name) ?? tag ?? undefined,
        body: capped(release.body),
        url: str(release.html_url) ?? undefined,
        author: str(obj(release.author).login) ?? undefined,
      },
      dateOf(release.published_at),
    ),
  ];
}
