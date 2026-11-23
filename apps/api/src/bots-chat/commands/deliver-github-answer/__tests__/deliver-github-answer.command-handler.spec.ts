import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { None, Some } from 'oxide.ts';
import { AddAppIssueCommentCommand } from '../../../../github/commands/add-app-issue-comment/add-app-issue-comment.command';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { ChannelTurnLine } from '../../../domain/bot-channel-turn.policy';
import { githubAskTurn } from '../../../domain/bot-github-ask.policy';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { DeliverGithubAnswerCommand } from '../deliver-github-answer.command';
import { DeliverGithubAnswerCommandHandler } from '../deliver-github-answer.command-handler';

/**
 * An ask on GitHub answered where it was made: once the turn ended, its last
 * words are one comment of the App on the issue or pull request its opening
 * names, in the owner's scope. A turn still running, a console turn, and an
 * owner who left post nothing; GitHub refusing it does not fail the job (it
 * is not retried). That the App's comment wakes nothing again is
 * `githubAskVia` (`bot-github-ask.policy.spec.ts`).
 */
const organizationId = randomUUID();
const ownerUserId = randomUUID();
const installationId = randomUUID();
const bot = {
  id: randomUUID(),
  organizationId,
  provider: 'glm' as const,
  model: 'glm-5.3',
  effort: null,
};

function asked() {
  return githubAskTurn(bot, ownerUserId, {
    inboundEventId: randomUUID(),
    event: {
      kind: 'github_ask',
      via: 'mention',
      installationId,
      githubRepoId: '42',
      repository: 'acme/app',
      number: 7,
      isPullRequest: true,
      url: null,
      actorLogin: 'octocat',
    },
    label: null,
    context: { body: '@oppenheimer Feynman why is CI red?' },
  });
}

function ended(turn: BotTurnEntity): BotTurnEntity {
  turn.start(new Date());
  turn.end('completed', new Date(), {});
  return turn;
}

const LINES: ChannelTurnLine[] = [
  { role: 'assistant', content: 'Looking.' },
  { role: 'activity', content: '' },
  { role: 'assistant', content: 'The lint job fails on a missing import.' },
];

function setup(turn: BotTurnEntity, opening = asked().opening, scope: object | null = {}) {
  const turns = {
    findForRun: vi.fn(async (id: string) => (id === turn.id ? Some(turn) : None)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    findOpening: vi.fn(async () => opening),
    findTurnLines: vi.fn(async () => LINES),
  } satisfies Partial<BotMessageRepositoryPort>;
  const owners = { resolve: vi.fn(async () => scope) };
  const bus = { execute: vi.fn(async () => ({ htmlUrl: 'https://github.com/x' })) };
  const handler = new DeliverGithubAnswerCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    owners as unknown as BotOwnerScopeResolver,
    bus as unknown as CommandBus,
  );
  const deliver = () => handler.execute(new DeliverGithubAnswerCommand({ turnId: turn.id }));
  return { bus, deliver };
}

describe('DeliverGithubAnswerCommandHandler', () => {
  // Breaks if the answer goes to another thread, is posted as the person
  // (which would wake their routines), or carries the turn's earlier words.
  it('posts the turn’s last words as the App on the issue or pull request it was asked on', async () => {
    const built = asked();
    const { bus, deliver } = setup(ended(built.turn), built.opening);
    await deliver();

    expect(bus.execute).toHaveBeenCalledTimes(1);
    const [sent] = bus.execute.mock.calls[0] as unknown as [AddAppIssueCommentCommand];
    expect(sent).toBeInstanceOf(AddAppIssueCommentCommand);
    expect(sent).toMatchObject({
      address: { kind: 'installation', installationId, githubRepoId: 42, number: 7 },
      body: 'The lint job fails on a missing import.',
    });
  });

  // Breaks if an answer is posted before the turn ends, for a console turn,
  // or after the owner left the workspace.
  it('posts nothing for a turn still running, a console turn, or an owner no longer there', async () => {
    const running = setup(asked().turn);
    await running.deliver();
    expect(running.bus.execute).not.toHaveBeenCalled();

    const console = setup(
      ended(BotTurnEntity.queue({ ...bot, botId: bot.id, requestedByUserId: ownerUserId })),
    );
    await console.deliver();
    expect(console.bus.execute).not.toHaveBeenCalled();

    const built = asked();
    const gone = setup(ended(built.turn), built.opening, null);
    await gone.deliver();
    expect(gone.bus.execute).not.toHaveBeenCalled();
  });

  // Breaks if GitHub refusing the comment fails the job, which is not retried
  // and would only be noise.
  it('does not throw when GitHub refuses the comment', async () => {
    const built = asked();
    const { bus, deliver } = setup(ended(built.turn), built.opening);
    bus.execute.mockRejectedValueOnce(new Error('Resource not accessible by integration'));
    await expect(deliver()).resolves.toBeUndefined();
  });
});
