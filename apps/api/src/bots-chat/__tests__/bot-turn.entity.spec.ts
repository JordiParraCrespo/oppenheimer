import { randomUUID } from 'node:crypto';
import { BOT_TURN_ERROR_MAX, BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * How a turn ends: a failure keeps its words cut to what `bot_turn.error`
 * holds, so storing the end can never fail on its length and leave the turn
 * running; any other ending keeps no error. And how a turn another bot asked
 * for is made: in the `bots` lane, one bot deeper in the asker's chain, with
 * no more reach than the asker's turn, and its answer only for an ask that
 * ended. The column's own limit is the integration suite's.
 */
function running(): BotTurnEntity {
  const turn = BotTurnEntity.queue({
    organizationId: randomUUID(),
    botId: randomUUID(),
    requestedByUserId: randomUUID(),
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
  });
  turn.start(new Date());
  return turn;
}

describe('BotTurnEntity.end', () => {
  it('keeps a failure that fits as it is', () => {
    const turn = running();
    const error = 'x'.repeat(BOT_TURN_ERROR_MAX);
    turn.end('failed', new Date(), { error });
    expect(turn.error).toBe(error);
  });

  it('cuts a longer failure to the column, marking the cut', () => {
    const turn = running();
    turn.end('failed', new Date(), { error: 'x'.repeat(2_001) });
    expect(turn.error).toHaveLength(BOT_TURN_ERROR_MAX);
    expect(turn.error?.endsWith('…')).toBe(true);
  });

  it('never cuts a character in half', () => {
    const turn = running();
    turn.end('failed', new Date(), { error: `${'x'.repeat(BOT_TURN_ERROR_MAX - 2)}😀😀` });
    expect(turn.error).toBe(`${'x'.repeat(BOT_TURN_ERROR_MAX - 2)}…`);
  });

  it('keeps no error when it does not fail', () => {
    const turn = running();
    turn.end('cancelled', new Date(), { error: 'ignored' });
    expect(turn.error).toBeNull();
  });

  // The chat says from the kind whether sending it again helps: a turn whose
  // worker died runs fine when sent again, and only a failed turn has a kind.
  it('keeps the kind of failure only on a failed turn, and marks an abandoned turn interrupted', () => {
    const failed = running();
    failed.end('failed', new Date(), { error: 'quota', failure: 'usage_limit' });
    expect(failed.failure).toBe('usage_limit');

    const cancelled = running();
    cancelled.end('cancelled', new Date(), { failure: 'refused' });
    expect(cancelled.failure).toBeNull();

    const abandoned = running();
    abandoned.abandon(new Date());
    expect(abandoned.failure).toBe('interrupted');
  });
});

describe('BotTurnEntity, between bots', () => {
  const engine = { provider: 'anthropic' as const, model: 'claude-sonnet-5-5', effort: null };

  it('queues a message from a bot in the bots lane, one bot deeper in the chain your message started', () => {
    const yours = running();
    const target = randomUUID();
    const asked = BotTurnEntity.queueFromBot(yours, {
      botId: target,
      ...engine,
      replyRequested: true,
    });
    expect(asked).toMatchObject({
      botId: target,
      lane: 'bots',
      chainId: yours.id,
      chainRoot: yours.id,
      chainDepth: 1,
      askedByBotId: yours.botId,
      askedByTurnId: yours.id,
      replyRequested: true,
      requestedByUserId: yours.requestedByUserId,
      status: 'queued',
    });
    asked.start(new Date());
    const further = BotTurnEntity.queueFromBot(asked, {
      botId: randomUUID(),
      ...engine,
      replyRequested: false,
    });
    expect(further).toMatchObject({ chainId: yours.id, chainDepth: 2, askedByTurnId: asked.id });
  });

  it('gives the asked turn no more reach than the asking one: its zone and credential scopes', () => {
    const asking = BotTurnEntity.queue({
      organizationId: randomUUID(),
      botId: randomUUID(),
      requestedByUserId: randomUUID(),
      ...engine,
      timeZone: 'Europe/Madrid',
      credentialScopes: ['bots:read'],
    });
    const asked = BotTurnEntity.queueFromBot(asking, {
      botId: randomUUID(),
      ...engine,
      replyRequested: false,
    });
    expect(asked.timeZone).toBe('Europe/Madrid');
    expect(asked.credentialScopes).toEqual(['bots:read']);
  });

  it('answers an ask that ended on the asker, at its depth, marked as answering it', () => {
    const yours = running();
    const asked = BotTurnEntity.queueFromBot(yours, {
      botId: randomUUID(),
      ...engine,
      replyRequested: true,
    });
    asked.start(new Date());
    asked.end('completed', new Date());
    const answer = BotTurnEntity.queueAnswer(asked, { botId: yours.botId, ...engine });
    expect(answer).toMatchObject({
      botId: yours.botId,
      lane: 'bots',
      chainId: yours.id,
      chainDepth: 0,
      askedByBotId: asked.botId,
      answersTurnId: asked.id,
      replyRequested: false,
    });
  });

  it('refuses to answer an ask still running, or a message that asked for no answer', () => {
    const yours = running();
    const asked = BotTurnEntity.queueFromBot(yours, {
      botId: randomUUID(),
      ...engine,
      replyRequested: true,
    });
    asked.start(new Date());
    expect(() => BotTurnEntity.queueAnswer(asked, { botId: yours.botId, ...engine })).toThrow(
      'Only an ended ask is answered',
    );
    const told = BotTurnEntity.queueFromBot(yours, {
      botId: randomUUID(),
      ...engine,
      replyRequested: false,
    });
    told.start(new Date());
    told.end('completed', new Date());
    expect(() => BotTurnEntity.queueAnswer(told, { botId: yours.botId, ...engine })).toThrow(
      'Only an ended ask is answered',
    );
  });

  it('queues nothing more for a turn whose sender no longer has an account', () => {
    const orphan = BotTurnEntity.create({
      id: randomUUID(),
      props: { ...running().getProps(), requestedByUserId: null },
    });
    expect(() =>
      BotTurnEntity.queueFromBot(orphan, { botId: randomUUID(), ...engine, replyRequested: false }),
    ).toThrow('no longer has an account');
  });
});

describe('BotTurnEntity.queue as a steer', () => {
  it('lets only a message of yours steer, never a routine run', () => {
    const steer = {
      organizationId: randomUUID(),
      botId: randomUUID(),
      requestedByUserId: randomUUID(),
      provider: 'glm' as const,
      model: 'glm-5.3',
      effort: null,
      steer: true,
    };
    expect(BotTurnEntity.queue(steer).steer).toBe(true);
    expect(() => BotTurnEntity.queue({ ...steer, origin: 'routine' })).toThrow(
      'Only a message of yours steers',
    );
  });
});
