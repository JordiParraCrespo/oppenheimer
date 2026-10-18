import { randomUUID } from 'node:crypto';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import { BotErrors } from '../../../../bots/domain/bots.errors';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { DeliverBotAnswerCommand } from '../deliver-bot-answer.command';
import { DeliverBotAnswerCommandHandler } from '../deliver-bot-answer.command-handler';

/**
 * An ask's answer going back: the asked turn's last text opens a turn of the
 * bot that asked, on that bot's engine, marked as from the bot that answered;
 * a failed ask says it failed. Nothing is queued for a message that asked for
 * no answer, an ask still running, or an asker since deleted; a repeated job
 * that finds the answer already queued publishes nothing. The answer's
 * uniqueness itself is the integration spec's.
 */
const organizationId = randomUUID();
const userId = randomUUID();

function bot(name: string): BotEntity {
  return BotEntity.createNew({
    organizationId,
    createdByUserId: userId,
    name,
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'glm',
  });
}

function setup(
  options: {
    ask?: boolean;
    end?: 'completed' | 'failed' | null;
    askerGone?: boolean;
    queued?: Awaited<ReturnType<BotTurnRepositoryPort['enqueueAnswer']>>;
  } = {},
) {
  const ada = bot('Ada');
  const grace = bot('Grace');
  const yours = BotTurnEntity.queue({
    organizationId,
    botId: ada.id,
    requestedByUserId: userId,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
  });
  yours.start(new Date());
  const asked = BotTurnEntity.queueFromBot(yours, {
    botId: grace.id,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    replyRequested: options.ask ?? true,
  });
  asked.start(new Date());
  const end = options.end === undefined ? 'completed' : options.end;
  if (end) asked.end(end, new Date(), end === 'failed' ? { error: 'The key was refused.' } : {});

  const turns = {
    findForRun: vi.fn(async (id: string) => (id === asked.id ? Some(asked) : None)),
    enqueueAnswer: vi.fn(async () => options.queued ?? ('staged' as const)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    findTurnTexts: vi.fn(async () => ['Looking it up.', 'PR 412 is task 7.']),
  } satisfies Partial<BotMessageRepositoryPort>;
  const access = {
    bot: vi.fn(async (_organizationId: string, id: string) => {
      if (id === ada.id && options.askerGone) throw new AppError(BotErrors.NOT_FOUND);
      return id === ada.id ? ada : grace;
    }),
  } satisfies Partial<BotModelAccessResolver>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const handler = new DeliverBotAnswerCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    stream,
    access as unknown as BotModelAccessResolver,
  );
  const deliver = () => handler.execute(new DeliverBotAnswerCommand({ turnId: asked.id }));
  return { ada, grace, asked, turns, stream, deliver };
}

describe('DeliverBotAnswerCommandHandler', () => {
  it('queues the asked turn’s last text on the asker, marked as answered by the bot that wrote it', async () => {
    const { ada, grace, asked, turns, stream, deliver } = setup();
    await deliver();
    const [turn, message] = turns.enqueueAnswer.mock.calls[0];
    expect(turn).toMatchObject({ botId: ada.id, lane: 'bots', answersTurnId: asked.id });
    expect(message).toMatchObject({ botId: ada.id, role: 'event', content: 'PR 412 is task 7.' });
    expect(message.event).toEqual({
      kind: 'bot_reply',
      fromBotId: grace.id,
      fromBotName: 'Grace',
      outcome: 'answered',
    });
    expect(stream.publish).toHaveBeenCalledWith(ada.id, {
      type: 'turn',
      turnId: turn.id,
      status: 'queued',
    });
  });

  it('tells the asker an ask failed, with why', async () => {
    const { turns, deliver } = setup({ end: 'failed' });
    await deliver();
    const [, message] = turns.enqueueAnswer.mock.calls[0];
    expect(message.content).toBe('The key was refused.');
    expect(message.event).toMatchObject({ kind: 'bot_reply', outcome: 'failed' });
  });

  it('queues nothing for a message that asked for no answer, an ask still running, or a deleted asker', async () => {
    for (const options of [{ ask: false }, { end: null }, { askerGone: true }]) {
      const { turns, stream, deliver } = setup(options);
      await deliver();
      expect(turns.enqueueAnswer).not.toHaveBeenCalled();
      expect(stream.publish).not.toHaveBeenCalled();
    }
  });

  it('publishes nothing when a repeated job finds the answer already queued', async () => {
    const { stream, deliver } = setup({ queued: 'duplicate' });
    await deliver();
    expect(stream.publish).not.toHaveBeenCalled();
  });
});
