import { randomUUID } from 'node:crypto';
import { BOT_TURN_ERROR_MAX, BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * How a turn ends: a failure keeps its words cut to what `bot_turn.error`
 * holds, so storing the end can never fail on its length and leave the turn
 * running; any other ending keeps no error. The column's own limit is the
 * integration suite's.
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
});
