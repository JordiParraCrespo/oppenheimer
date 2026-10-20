import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AddIssueCommentCommand } from '../../../github/commands/add-issue-comment/add-issue-comment.command';
import { AddPullRequestCommentCommand } from '../../../pull-requests/commands/add-pull-request-comment/add-pull-request-comment.command';
import { MergePullRequestCommand } from '../../../pull-requests/commands/merge-pull-request/merge-pull-request.command';
import { StartReviewSessionCommand } from '../../../pull-requests/commands/start-review-session/start-review-session.command';
import { SubmitPullRequestReviewCommand } from '../../../pull-requests/commands/submit-pull-request-review/submit-pull-request-review.command';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotPullRequestToolsFactory } from '../bot-pull-request-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * Commenting, reviewing, merging and review sessions reach GitHub or a host
 * in the owner's name, so they ask: under Approve for me nothing is
 * dispatched, a card names the pull request by repository, number and
 * title, and a merge's card is pinned to the head it was raised on, so a
 * push while it waits is never merged unseen. Under Full access the
 * pull-requests module's own commands run in the owner's scope. The
 * commands themselves are that module's specs.
 */
const owner = emptyScope('owner-1', 'org-1');
const INSTALLATION = '11111111-1111-4111-8111-111111111111';
const HOME = '33333333-3333-4333-8333-333333333333';
const HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const PR = { installation_id: INSTALLATION, github_repo_id: 7, number: 412 };

const pull = (overrides: Record<string, unknown> = {}) => ({
  repository: 'acme/api',
  number: 412,
  title: 'Fix the thing',
  state: 'open',
  headSha: HEAD,
  ...overrides,
});

function setup(
  permission: BotToolContext['permission'],
  read: () => unknown = () => pull(),
  homeHostId: string | null = HOME,
) {
  const queryBus = { execute: vi.fn(async () => read()) };
  const commandBus = {
    execute: vi.fn(async (command: unknown) =>
      command instanceof StartReviewSessionCommand
        ? { sessionId: 'session-1', hints: [] as string[] }
        : { htmlUrl: 'https://github.com/acme/api/pull/412#issuecomment-1' },
    ),
  };
  const approvals = {
    request: vi.fn<BotApprovalRequesterPort['request']>(async () => ({
      status: 'requested',
      approvalId: 'approval-1',
    })),
  };
  const context: BotToolContext = {
    owner,
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId,
    timeZone: 'UTC',
    permission,
    approvals,
    budget: new BotTurnBudget(),
  };
  const factory = new BotPullRequestToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
  );
  const definition = (name: string) => {
    const found = factory.definitions().find((candidate) => candidate.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found;
  };
  const call = (name: string, input: unknown) =>
    definition(name).bind(context).run(input, { signal: new AbortController().signal });
  const dispatched = () => commandBus.execute.mock.calls.map(([command]) => command);
  return { call, definition, context, approvals, dispatched };
}

describe('BotPullRequestToolsFactory under Approve for me', () => {
  it('raises a merge card that names the pull request and is pinned to its head, and merges nothing', async () => {
    const { call, approvals, dispatched } = setup('auto');

    const result = await call('merge_pull_request', PR);

    expect(dispatched()).toEqual([]);
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'merge_pull_request',
        input: expect.objectContaining({ number: 412, method: 'squash', head_sha: HEAD }),
        summary: 'Merge acme/api#412 "Fix the thing" (squash, at a1b2c3d)',
      }),
    );
    expect(result.isError).toBeFalsy();
  });

  it('raises no card for a pull request that is already merged, or one pushed to since the bot read it', async () => {
    const merged = setup('auto', () => pull({ state: 'merged' }));
    const closed = await merged.call('merge_pull_request', PR);
    const moved = setup('auto');
    const stale = await moved.call('merge_pull_request', { ...PR, head_sha: 'ffff000' });

    expect(closed).toMatchObject({ isError: true, content: expect.stringContaining('is merged') });
    expect(stale).toMatchObject({
      isError: true,
      content: expect.stringContaining('get_pull_request'),
    });
    expect(merged.approvals.request).not.toHaveBeenCalled();
    expect(moved.approvals.request).not.toHaveBeenCalled();
  });

  it('says on a review card what the verdict is, and refuses a request for changes with nothing said', async () => {
    const { call, approvals } = setup('auto');

    await call('review_pull_request', { ...PR, verdict: 'approve' });
    const empty = await call('review_pull_request', { ...PR, verdict: 'request_changes' });

    expect(approvals.request).toHaveBeenCalledTimes(1);
    expect(approvals.request.mock.calls[0]?.[0].summary).toBe(
      'Approve acme/api#412 "Fix the thing"',
    );
    expect(empty.isError).toBe(true);
  });

  it('refuses a line comment missing its line before any card', async () => {
    const { call, approvals } = setup('auto');

    const result = await call('comment_on_pull_request', { ...PR, body: 'Nit', path: 'src/a.ts' });

    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('path and line'),
    });
    expect(approvals.request).not.toHaveBeenCalled();
  });
});

describe('BotPullRequestToolsFactory carrying out an approved call', () => {
  it('merges in the owner’s scope at the head the card stored', async () => {
    const { definition, context, dispatched } = setup('auto');

    const result = await definition('merge_pull_request').runApproved(
      { ...PR, method: 'squash', head_sha: HEAD },
      { ...context, approvalId: 'approval-1' },
      new AbortController().signal,
    );

    const [merge] = dispatched() as MergePullRequestCommand[];
    expect(merge).toBeInstanceOf(MergePullRequestCommand);
    expect(merge).toMatchObject({
      scope: owner,
      address: { installationId: INSTALLATION, githubRepoId: 7, number: 412 },
      method: 'squash',
      expectedHeadSha: HEAD,
    });
    expect(result.isError).toBe(false);
  });

  it('starts one review session per approval on the stored host, and links the chat to it', async () => {
    const { definition, context, dispatched } = setup('auto');

    const result = await definition('start_review_session').runApproved(
      { ...PR, host_id: HOME },
      { ...context, approvalId: 'approval-1' },
      new AbortController().signal,
    );

    const [start] = dispatched() as StartReviewSessionCommand[];
    expect(start).toBeInstanceOf(StartReviewSessionCommand);
    expect(start).toMatchObject({ hostId: HOME, idempotencyKey: 'bot:approval:approval-1' });
    expect(result.sessionId).toBe('session-1');
  });
});

describe('BotPullRequestToolsFactory under Full access', () => {
  it('posts a conversation comment without path and a line comment with one', async () => {
    const { call, dispatched } = setup('full');

    await call('comment_on_pull_request', { ...PR, body: 'Looks good' });
    await call('comment_on_pull_request', { ...PR, body: 'Nit', path: 'src/a.ts', line: 3 });

    const [conversation, line] = dispatched();
    expect(conversation).toBeInstanceOf(AddIssueCommentCommand);
    expect(conversation).toMatchObject({ scope: owner, body: 'Looks good' });
    expect(line).toBeInstanceOf(AddPullRequestCommentCommand);
    expect(line).toMatchObject({
      comment: { path: 'src/a.ts', line: 3, side: 'RIGHT', body: 'Nit' },
    });
  });

  it('submits the review the bot chose, never approve-and-merge', async () => {
    const { call, dispatched } = setup('full');

    await call('review_pull_request', { ...PR, verdict: 'request_changes', body: 'Add a test' });
    const merging = await call('review_pull_request', { ...PR, verdict: 'approve_and_merge' });

    expect(dispatched()).toHaveLength(1);
    expect(dispatched()[0]).toBeInstanceOf(SubmitPullRequestReviewCommand);
    expect(dispatched()[0]).toMatchObject({
      review: { verdict: 'request_changes', body: 'Add a test', comments: [] },
    });
    expect(merging.isError).toBe(true);
  });

  it('refuses a review session with no host to run on, starting nothing', async () => {
    const { call, dispatched } = setup('full', () => pull(), null);

    const result = await call('start_review_session', PR);

    expect(result).toMatchObject({ isError: true, content: expect.stringContaining('list_hosts') });
    expect(dispatched()).toEqual([]);
  });
});
