/**
 * Entities for tests: real instances, every field filled with a value that
 * reads as ordinary, and the fields a test is about given as overrides.
 *
 * A test that builds an entity as an object literal cast through `unknown`
 * keeps passing when the code under test starts reading a field the literal
 * left out, or calls a method the literal does not have; one built here gets
 * the entity's own getters and methods, and the type checks every override.
 */
import {
  AutomationRunEntity,
  type AutomationRunEntityProps,
} from '../modules/automations/automation.entity';
import {
  PullRequestEntity,
  type PullRequestEntityProps,
} from '../modules/pull-requests/pull-request.entity';
import {
  SessionCheckoutEntity,
  SessionEntity,
  type SessionEntityProps,
} from '../modules/sessions/session.entity';

const CREATED = new Date('2026-01-01T09:00:00Z');

/** One repository a session checked out, on the session's own branch. */
export function sessionCheckout(
  overrides: { githubRepoId?: string; repositoryFullName?: string } = {},
): SessionCheckoutEntity {
  const repositoryFullName = overrides.repositoryFullName ?? 'acme/app';
  const githubRepoId = overrides.githubRepoId ?? repositoryFullName;
  return new SessionCheckoutEntity(
    `checkout-${githubRepoId}`,
    'installation-1',
    githubRepoId,
    repositoryFullName,
    repositoryFullName.split('/').at(-1) ?? repositoryFullName,
    'main',
    'feature',
  );
}

/** A session on a host, in its worktree, working. */
export function sessionEntity(overrides: Partial<SessionEntityProps> = {}): SessionEntity {
  const id = overrides.id ?? 'session-1';
  return new SessionEntity({
    id,
    organizationId: 'org-1',
    projectId: 'project-1',
    hostId: 'host-1',
    name: id,
    slug: id,
    agent: 'claude-code',
    launch: { model: null, permission: null, effort: null },
    state: 'working',
    lifecycle: 'open',
    cwdCheckoutId: null,
    checkouts: [],
    stoppedAt: null,
    hints: [],
    createdAt: CREATED,
    place: 'worktree',
    folderPath: null,
    ...overrides,
  });
}

/** An open pull request by a person, small, checks passing. */
export function pullRequestEntity(
  overrides: Partial<PullRequestEntityProps> = {},
): PullRequestEntity {
  const number = overrides.number ?? 1;
  return new PullRequestEntity({
    installationId: 'installation-1',
    githubRepoId: 1,
    repository: 'acme/app',
    number,
    title: `PR ${number}`,
    author: 'octo',
    authorKind: 'person',
    headRef: 'feature',
    scope: 'mine',
    lane: 'quick',
    laneReason: { code: 'small_change', lines: 10, files: 1 },
    additions: 5,
    deletions: 5,
    checks: 'passing',
    mergeable: true,
    blocker: null,
    waitingSeconds: 0,
    draft: false,
    htmlUrl: `https://github.com/acme/app/pull/${number}`,
    checksRefusal: null,
    unread: [],
    headSha: 'abc123',
    openedAt: CREATED,
    ...overrides,
  });
}

/** A scheduled run of an automation, completed with a session. */
export function automationRunEntity(
  overrides: Partial<AutomationRunEntityProps> = {},
): AutomationRunEntity {
  const id = overrides.id ?? 'run-1';
  return new AutomationRunEntity({
    id,
    automationId: 'automation-1',
    automationName: 'Nightly',
    automationDeleted: false,
    projectId: 'project-1',
    status: 'completed',
    outcome: 'dispatched',
    skipReason: null,
    cause: 'schedule',
    causeSummary: { label: 'Schedule', text: 'Every night', eventType: 'schedule' },
    title: id,
    sessionId: `session-${id}`,
    branch: null,
    revisionNumber: 1,
    agent: 'claude-code',
    model: null,
    hostId: 'host-1',
    createdAt: CREATED,
    startedAt: CREATED,
    endedAt: null,
    durationMs: null,
    turn: null,
    ...overrides,
  });
}
