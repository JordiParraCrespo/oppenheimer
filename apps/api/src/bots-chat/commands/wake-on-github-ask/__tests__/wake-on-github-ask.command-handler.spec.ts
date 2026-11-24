import { randomUUID } from 'node:crypto';
import { None, Some } from 'oxide.ts';
import type { InboundEventLookupPort } from '../../../../inbound-events/application/inbound-event-lookup.port';
import type { StoredExternalEvent } from '../../../../inbound-events/domain/external-event.types';
import type { BotGithubAskResolver } from '../../../application/bot-github-ask.resolver';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../../../domain/bot-message.entity';
import type { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { WakeOnGithubAskCommand } from '../wake-on-github-ask.command';
import { WakeOnGithubAskCommandHandler } from '../wake-on-github-ask.command-handler';

/**
 * An ask on GitHub reaching a bot: the owner's mention or label queues one
 * turn of the bot it names, in the background, keyed by the stored event,
 * opened by a `github_ask` line that says where to answer. Anyone else's ask,
 * one naming no bot of theirs, and one in a repository no installation
 * covers queue nothing. Which events reach here is `githubAskVia`
 * (`bot-github-ask.policy.spec.ts`); the answer going back is
 * `deliver-github-answer.command-handler.spec.ts`.
 */
const organizationId = randomUUID();
const ownerUserId = randomUUID();
const installationId = randomUUID();
const inboundEventId = randomUUID();
const bot = {
  id: randomUUID(),
  organizationId,
  name: 'Feynman',
  provider: 'glm' as const,
  model: 'glm-5.3',
  effort: null,
  createdByUserId: ownerUserId,
};

function storedMention(
  overrides: Partial<StoredExternalEvent> = {},
  body = '@oppenheimer Feynman why is CI red?',
): StoredExternalEvent {
  return {
    id: inboundEventId,
    organizationId,
    receivedAt: new Date(),
    source: 'github',
    type: 'mention',
    externalId: 'delivery-1:mention',
    subject: { kind: 'repository', ref: '42', name: 'acme/app' },
    actor: { login: 'octocat', isOwnApp: false },
    attributes: { number: 7, commentId: 9, isPullRequest: true },
    context: { body, url: 'https://github.com/acme/app/pull/7#issuecomment-9' },
    occurredAt: new Date(),
    schemaVersion: 1,
    ...overrides,
  };
}

function setup(event: StoredExternalEvent | null, covering: string | null = installationId) {
  const events = {
    findOne: vi.fn(async () => (event ? Some(event) : None)),
  } satisfies Partial<InboundEventLookupPort>;
  const turns = {
    enqueueOnce: vi.fn(async (turn: BotTurnEntity, _opening: BotMessageEntity) => ({
      outcome: 'staged' as const,
      turnId: turn.id,
    })),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn(async () => undefined) } satisfies Partial<BotStreamPort>;
  const asks = {
    owner: vi.fn(async () => ({ userId: ownerUserId, scope: {} as never, login: 'OctoCat' })),
    ownBots: vi.fn(async () => [bot]),
    installationCovering: vi.fn(async () => covering),
  } satisfies Partial<Record<keyof BotGithubAskResolver, unknown>>;
  const handler = new WakeOnGithubAskCommandHandler(
    events as unknown as InboundEventLookupPort,
    turns as unknown as BotTurnRepositoryPort,
    stream as unknown as BotStreamPort,
    asks as unknown as BotGithubAskResolver,
  );
  const wake = (via: 'mention' | 'label' = 'mention') =>
    handler.execute(new WakeOnGithubAskCommand({ organizationId, inboundEventId, via }));
  return { turns, stream, asks, wake };
}

describe('WakeOnGithubAskCommandHandler', () => {
  // Breaks if the owner's mention queues no turn, a turn in the owner lane
  // (which would block their console chat), or one a redelivery doubles.
  it('queues one background turn of the named bot, as its owner, opened by where to answer', async () => {
    const { turns, stream, wake } = setup(storedMention());
    await wake();

    expect(turns.enqueueOnce).toHaveBeenCalledTimes(1);
    const [turn, opening] = turns.enqueueOnce.mock.calls[0] ?? [];
    expect(turn).toMatchObject({
      botId: bot.id,
      origin: 'github',
      lane: 'background',
      requestedByUserId: ownerUserId,
      sourceKey: `github:${inboundEventId}`,
    });
    expect(opening?.event).toEqual({
      kind: 'github_ask',
      via: 'mention',
      installationId,
      githubRepoId: '42',
      repository: 'acme/app',
      number: 7,
      isPullRequest: true,
      url: 'https://github.com/acme/app/pull/7#issuecomment-9',
      actorLogin: 'octocat',
    });
    expect(opening?.content).toContain('why is CI red?');
    expect(stream.publish).toHaveBeenCalledWith(bot.id, expect.objectContaining({ type: 'turn' }));
  });

  // Breaks if someone else on the repository can start a turn of the owner's
  // bot, or their words are read before the asker is known.
  it('queues nothing for a mention by someone other than the owner', async () => {
    const { turns, asks, wake } = setup(
      storedMention({ actor: { login: 'mallory', isOwnApp: false } }),
    );
    await wake();
    expect(asks.ownBots).not.toHaveBeenCalled();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
  });

  // Breaks if a mention naming no bot, or a repository the App cannot post
  // in, queues a turn whose answer has nowhere to go.
  it('queues nothing when no bot is named or no installation covers the repository', async () => {
    const unnamed = setup(storedMention({}, '@oppenheimer can someone look?'));
    await unnamed.wake();
    expect(unnamed.turns.enqueueOnce).not.toHaveBeenCalled();

    const uncovered = setup(storedMention(), null);
    await uncovered.wake();
    expect(uncovered.turns.enqueueOnce).not.toHaveBeenCalled();
  });

  // Breaks if a label ask is matched against the issue's text instead of
  // the label.
  it('names the bot by the label for a label ask', async () => {
    const { turns, wake } = setup(
      storedMention(
        {
          type: 'issue_labeled',
          attributes: { number: 7, isPullRequest: false, label: 'bot:feynman' },
        },
        'An issue body that names nobody',
      ),
    );
    await wake('label');
    const [, opening] = turns.enqueueOnce.mock.calls[0] ?? [];
    expect(opening?.event).toMatchObject({ via: 'label', isPullRequest: false });
  });
});
