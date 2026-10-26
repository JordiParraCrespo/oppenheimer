import { describe, expect, it } from 'vitest';
import { AutomationRunEntity } from '../../automations/automation.entity';
import { BotApprovalEntity, WorkspaceBotApprovalEntity } from '../../bots/bot-conversation.entity';
import { ProjectEntity } from '../../projects/project.entity';
import { PullRequestEntity } from '../../pull-requests/pull-request.entity';
import { SessionEntity, type SessionGroup, type SessionState } from '../../sessions/session.entity';
import { composeInbox, type InboxSources, sessionItemKey } from '../inbox-item';
import { InboxMarkEntity } from '../inbox-mark.entity';

/**
 * The Inbox (`product/versions/mvp/28-inbox.md`): an item per occurrence of a
 * wait, in the order "most blocked first", filed under its projects, and the
 * reader's marks applied to that occurrence only — so a new wait comes back
 * however the last one was marked.
 */

const NOW = Date.parse('2026-10-26T12:00:00Z');
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000);

function session(
  id: string,
  {
    state = 'waiting-on-you',
    lifecycle = 'open',
    observedSince = at(10),
    stateSeq = 1,
    projectId = 'p-app',
  }: {
    state?: SessionGroup;
    lifecycle?: SessionState;
    observedSince?: Date | null;
    stateSeq?: number;
    projectId?: string;
  } = {},
): SessionEntity {
  return new SessionEntity(
    id,
    'org-1',
    projectId,
    'host-1',
    `Session ${id}`,
    id,
    'claude-code',
    { model: null, permission: 'ask', effort: null },
    state,
    lifecycle,
    null,
    [],
    null,
    [],
    at(120),
    'worktree',
    null,
    null,
    null,
    observedSince,
    at(5),
    stateSeq,
  );
}

function approval(id: string, minutesAgo: number, sessionId: string | null = null) {
  return new WorkspaceBotApprovalEntity(
    new BotApprovalEntity(
      id,
      't-1',
      'start_session',
      'Start a session',
      'pending',
      null,
      at(minutesAgo),
    ),
    'bot-1',
    'Ops',
    sessionId,
    {},
  );
}

function pull(
  number: number,
  {
    scope = 'requested',
    blocker = null,
    headSha = 'aaa111',
    openedMinutesAgo = 60,
    githubRepoId = 42,
  }: {
    scope?: 'mine' | 'requested' | 'watching';
    blocker?: 'conflicts' | null;
    headSha?: string;
    openedMinutesAgo?: number;
    githubRepoId?: number;
  } = {},
) {
  return new PullRequestEntity(
    'inst-1',
    githubRepoId,
    'acme/app',
    number,
    `PR ${number}`,
    'octo',
    'person',
    'feature',
    scope,
    'quick',
    { code: 'small_change', lines: 10, files: 1 },
    5,
    5,
    'passing',
    true,
    blocker,
    openedMinutesAgo * 60,
    false,
    `https://github.com/acme/app/pull/${number}`,
    null,
    [],
    headSha,
    at(openedMinutesAgo),
  );
}

function run(id: string, minutesAgo: number, projectId: string | null = 'p-app') {
  return new AutomationRunEntity(
    id,
    'auto-1',
    'Nightly audit',
    false,
    projectId,
    'failed',
    'failed' as never,
    null,
    'schedule' as never,
    { label: 'Schedule', text: 'Every night', eventType: 'schedule' },
    'Audit',
    null,
    null,
    1,
    'claude-code',
    null,
    'host-1',
    at(minutesAgo + 5),
    at(minutesAgo + 4),
    at(minutesAgo),
    60_000,
    null,
  );
}

function project(id: string, repoIds: string[], isUnassigned = false) {
  return new ProjectEntity(
    id,
    id,
    id,
    isUnassigned,
    null,
    null,
    repoIds.map((githubRepoId) => ({
      id: githubRepoId,
      installationId: 'inst-1',
      githubRepoId,
      fullName: `acme/${githubRepoId}`,
      isDefault: true,
      baseBranch: 'main',
    })),
    at(1000),
    at(1000),
  );
}

function sources(overrides: Partial<InboxSources> = {}): InboxSources {
  return {
    sessions: [],
    approvals: [],
    requested: [],
    mine: [],
    failedRuns: [],
    projects: [project('p-app', ['42']), project('p-web', ['42']), project('p-none', [], true)],
    ...overrides,
  };
}

const mark = (itemKey: string, kind: InboxMarkEntity['mark'], until: Date | null = null) =>
  new InboxMarkEntity(itemKey, kind, until, at(1));

describe('composeInbox: what needs you, and in what order', () => {
  it('puts approvals and waiting sessions first, oldest wait first, then requested reviews, ready merges and failed runs', () => {
    const view = composeInbox(
      sources({
        sessions: [
          session('s-new', { observedSince: at(2) }),
          session('s-old', { observedSince: at(50) }),
        ],
        approvals: [approval('a-1', 20)],
        requested: [pull(1)],
        mine: [pull(2, { scope: 'mine' })],
        failedRuns: [run('r-1', 90)],
      }),
      [],
      NOW,
    );
    expect(view.open.map((item) => item.key)).toEqual([
      sessionItemKey(session('s-old', { observedSince: at(50) })),
      'approval:a-1',
      sessionItemKey(session('s-new', { observedSince: at(2) })),
      'pull:42#1@aaa111',
      'pull:42#2@aaa111',
      'run:r-1',
    ]);
  });

  it('leaves out what does not need you: a working session, and your pull request that is blocked', () => {
    const view = composeInbox(
      sources({
        sessions: [session('s-1', { state: 'working' })],
        mine: [pull(3, { scope: 'mine', blocker: 'conflicts' })],
      }),
      [],
      NOW,
    );
    expect(view.open).toEqual([]);
  });

  it('files a pull request under every project holding its repository, and the Unassigned project under none', () => {
    const view = composeInbox(
      sources({
        requested: [pull(1)],
        sessions: [session('s-1', { projectId: 'p-none' })],
        failedRuns: [run('r-1', 5, null)],
      }),
      [],
      NOW,
    );
    const projects = Object.fromEntries(view.open.map((item) => [item.kind, item.projectIds]));
    expect(projects).toEqual({ pull: ['p-app', 'p-web'], session: [], run: [] });
  });

  it('files an approval under the project of the session it concerns', () => {
    const view = composeInbox(
      sources({
        sessions: [session('s-1', { state: 'working', projectId: 'p-web' })],
        approvals: [approval('a-1', 1, 's-1')],
      }),
      [],
      NOW,
    );
    expect(view.open[0]?.projectIds).toEqual(['p-web']);
  });
});

describe('composeInbox: marks apply to one occurrence', () => {
  it('hides a done item from the list and keeps it for Show done; a deleted one is gone', () => {
    const view = composeInbox(
      sources({ approvals: [approval('a-1', 5), approval('a-2', 4)] }),
      [mark('approval:a-1', 'done'), mark('approval:a-2', 'deleted')],
      NOW,
    );
    expect(view.open).toEqual([]);
    expect(view.done.map((item) => item.key)).toEqual(['approval:a-1']);
  });

  it('brings a pull request back when a new push changes its head commit', () => {
    const view = composeInbox(
      sources({ requested: [pull(1, { headSha: 'bbb222' })] }),
      [mark('pull:42#1@aaa111', 'done')],
      NOW,
    );
    expect(view.open.map((item) => item.key)).toEqual(['pull:42#1@bbb222']);
  });

  it('brings a session back when it blocks again, and a failure back when it fails again', () => {
    const blockedAgain = session('s-1', { observedSince: at(1) });
    const failedAgain = session('s-2', { lifecycle: 'failed', observedSince: null, stateSeq: 5 });
    const view = composeInbox(
      sources({ sessions: [blockedAgain, failedAgain] }),
      [mark(`session:s-1:${at(30).toISOString()}`, 'done'), mark('session:s-2:s3', 'done')],
      NOW,
    );
    expect(view.open.map((item) => item.key)).toEqual([
      'session:s-2:s5',
      `session:s-1:${at(1).toISOString()}`,
    ]);
  });

  it('sorts a deprioritized item after everything else, read as Low', () => {
    const view = composeInbox(
      sources({ approvals: [approval('a-1', 60)], failedRuns: [run('r-1', 1)] }),
      [mark('approval:a-1', 'low')],
      NOW,
    );
    expect(view.open.map((item) => [item.key, item.low])).toEqual([
      ['run:r-1', false],
      ['approval:a-1', true],
    ]);
  });

  it('lists a snoozed item under Snoozed until its snooze ends, then back in the list', () => {
    const marks = [mark('run:r-1', 'snoozed', new Date(NOW + 60 * 60_000))];
    const before = composeInbox(sources({ failedRuns: [run('r-1', 1)] }), marks, NOW);
    expect(before.open).toEqual([]);
    expect(before.snoozed.map(({ item }) => item.key)).toEqual(['run:r-1']);

    const after = composeInbox(sources({ failedRuns: [run('r-1', 1)] }), marks, NOW + 61 * 60_000);
    expect(after.open.map((item) => item.key)).toEqual(['run:r-1']);
    expect(after.snoozed).toEqual([]);
  });
});
