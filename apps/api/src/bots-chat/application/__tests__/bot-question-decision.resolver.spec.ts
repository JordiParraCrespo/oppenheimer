import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotQuestionAnswer, Scope } from '@oppenheimer/shared';
import { Some } from 'oxide.ts';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BotEntity } from '../../../bots/domain/bot.entity';
import { AnswerBotQuestionCommand } from '../../commands/answer-bot-question/answer-bot-question.command';
import { AnswerBotQuestionCommandHandler } from '../../commands/answer-bot-question/answer-bot-question.command-handler';
import { DismissBotQuestionCommand } from '../../commands/dismiss-bot-question/dismiss-bot-question.command';
import { DismissBotQuestionCommandHandler } from '../../commands/dismiss-bot-question/dismiss-bot-question.command-handler';
import type { BotQuestionRepositoryPort } from '../../database/bot-question.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotQuestionEntity } from '../../domain/bot-question.entity';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { BotQuestionDecisionResolver } from '../bot-question-decision.resolver';

/**
 * Answering or dismissing a bot's card of questions (`25-bots.md` §3.2).
 * Either decision moves the card and queues, in the same write, the bot's
 * turn opened by what was decided, under what both the asking turn's and the
 * decider's scopes cover. Answers that do not fit are `BOTS_036` and write
 * nothing; a card already decided, or one that loses the conditional write
 * to a new message, is `BOTS_037` and announces nothing.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(options: { decided?: boolean; loses?: boolean; askedWith?: Scope[] | null } = {}) {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: scope.userId,
    name: 'Glm Bot',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'glm',
  });
  const asked = BotTurnEntity.queue({
    organizationId: bot.organizationId,
    botId: bot.id,
    requestedByUserId: scope.userId,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    timeZone: 'Europe/Madrid',
    credentialScopes: options.askedWith ?? null,
  });
  const card = BotQuestionEntity.ask({
    organizationId: bot.organizationId,
    botId: bot.id,
    turnId: asked.id,
    questions: [
      {
        header: null,
        question: 'Which repository?',
        multiSelect: false,
        options: [
          { label: 'acme/api', description: null },
          { label: 'acme/web', description: null },
        ],
      },
    ],
    summary: 'Which repository?',
  });
  if (options.decided) card.expire(new Date());
  const questions = {
    findOne: vi.fn(async () => Some(card)),
    saveTransition: vi.fn<BotQuestionRepositoryPort['saveTransition']>(async () => !options.loses),
  } satisfies Partial<BotQuestionRepositoryPort>;
  const turns = {
    findOne: vi.fn(async () => Some(asked)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const decisions = new BotQuestionDecisionResolver(
    { bot: async () => bot } as BotLookupPort,
    questions as unknown as BotQuestionRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
  );
  const answer = (answers: BotQuestionAnswer[], credentialScopes: Scope[] | null = null) =>
    new AnswerBotQuestionCommandHandler(decisions).execute(
      new AnswerBotQuestionCommand({
        scope,
        botId: bot.id,
        questionId: card.id,
        answers,
        deciderName: 'Ana',
        credentialScopes,
      }),
    );
  const dismiss = (note: string | null) =>
    new DismissBotQuestionCommandHandler(decisions).execute(
      new DismissBotQuestionCommand({
        scope,
        botId: bot.id,
        questionId: card.id,
        note,
        deciderName: 'Ana',
        credentialScopes: null,
      }),
    );
  return { bot, card, questions, stream, answer, dismiss };
}

describe('answering and dismissing a card of questions', () => {
  it('stores the answers and queues the turn that reads them, in one write', async () => {
    const { bot, card, questions, stream, answer } = setup();
    await expect(answer([{ picks: [1], other: null }])).resolves.toBe(card.id);
    expect(card).toMatchObject({ status: 'answered', decidedByUserId: scope.userId });
    const [saved, continuation] = questions.saveTransition.mock.calls[0];
    expect(saved).toBe(card);
    expect(continuation?.turn).toMatchObject({
      origin: 'question',
      status: 'queued',
      model: 'glm-5.3',
    });
    expect(continuation?.opening.event).toEqual({
      kind: 'question',
      outcome: 'answered',
      summary: 'Which repository?',
      answers: [{ question: 'Which repository?', answer: 'acme/web' }],
    });
    expect(continuation?.opening.content).toContain('Ana answered your questions.');
    expect(stream.publish).toHaveBeenCalledWith(bot.id, {
      type: 'question',
      questionId: card.id,
      status: 'answered',
    });
  });

  it('gives the next turn only what both the asking turn and the answering token cover', async () => {
    const { questions, answer } = setup({ askedWith: ['bots:write', 'sessions:read'] });
    await answer([{ picks: [0], other: null }], ['bots:write']);
    const [, continuation] = questions.saveTransition.mock.calls[0];
    expect(continuation?.turn.credentialScopes).toEqual(['bots:read', 'bots:write']);
  });

  it('refuses answers that do not fit with BOTS_036, writing nothing', async () => {
    const { card, questions, answer } = setup();
    await expect(answer([{ picks: [7], other: null }])).rejects.toMatchObject({
      code: 'BOTS_036',
      detail: 'Question 1 has 2 options',
    });
    expect(card.status).toBe('pending');
    expect(questions.saveTransition).not.toHaveBeenCalled();
  });

  it('dismisses with the note, and the bot is told not to ask again', async () => {
    const { card, questions, dismiss } = setup();
    await dismiss('Pick one yourself');
    expect(card).toMatchObject({ status: 'dismissed', note: 'Pick one yourself' });
    const [, continuation] = questions.saveTransition.mock.calls[0];
    expect(continuation?.opening.content).toContain('Do not ask them again');
    expect(continuation?.opening.event).toMatchObject({ outcome: 'dismissed', answers: [] });
  });

  it('answers BOTS_037 on a card already decided, writing nothing', async () => {
    const { questions, answer } = setup({ decided: true });
    await expect(answer([{ picks: [0], other: null }])).rejects.toMatchObject({
      code: 'BOTS_037',
    });
    expect(questions.saveTransition).not.toHaveBeenCalled();
  });

  it('answers BOTS_037 when a new message retired the card first, announcing nothing', async () => {
    const { stream, dismiss } = setup({ loses: true });
    await expect(dismiss(null)).rejects.toMatchObject({ code: 'BOTS_037' });
    expect(stream.publish).not.toHaveBeenCalled();
  });
});
