import { randomUUID } from 'node:crypto';
import type { Scope } from '@oppenheimer/shared';
import { takesSteer } from '../domain/bot-steer.policy';
import { BotTurnEntity, type BotTurnProps } from '../domain/bot-turn.entity';

/**
 * Which waiting steers a running turn takes: its own sender's, sent with the
 * same reach (the same credential scopes, in any order; a browser session's
 * only with a browser session's), into a turn of yours. Anything else waits
 * and runs as its own turn, so a token never steers through a session's
 * turn, nor one person through another's.
 */
const organizationId = randomUUID();
const botId = randomUUID();
const userId = randomUUID();

function turn(overrides: Partial<BotTurnProps> = {}, steer = true): BotTurnEntity {
  const queued = BotTurnEntity.queue({
    organizationId,
    botId,
    requestedByUserId: userId,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    steer,
  });
  return BotTurnEntity.create({ id: queued.id, props: { ...queued.getProps(), ...overrides } });
}

const running = (overrides: Partial<BotTurnProps> = {}) =>
  turn({ status: 'running', ...overrides }, false);

describe('takesSteer', () => {
  it("takes its own sender's waiting steer", () => {
    expect(takesSteer(running(), turn())).toBe(true);
  });

  it('leaves a message sent to wait, one already gone, and the turn itself', () => {
    const now = running();
    expect(takesSteer(now, turn({}, false))).toBe(false);
    expect(takesSteer(now, turn({ status: 'cancelled' }))).toBe(false);
    expect(takesSteer(now, BotTurnEntity.create({ id: now.id, props: turn().getProps() }))).toBe(
      false,
    );
  });

  it("leaves someone else's steer, and any once the running turn's sender is gone", () => {
    expect(takesSteer(running(), turn({ requestedByUserId: randomUUID() }))).toBe(false);
    expect(
      takesSteer(running({ requestedByUserId: null }), turn({ requestedByUserId: null })),
    ).toBe(false);
  });

  it('takes a steer only with the reach of the running turn', () => {
    const scopes: Scope[] = ['bots:read', 'bots:write'];
    expect(
      takesSteer(
        running({ credentialScopes: scopes }),
        turn({ credentialScopes: [...scopes].reverse() }),
      ),
    ).toBe(true);
    // A token's steer never reaches through a browser session's turn, nor the other way.
    expect(takesSteer(running(), turn({ credentialScopes: ['bots:write'] }))).toBe(false);
    expect(takesSteer(running({ credentialScopes: scopes }), turn())).toBe(false);
    expect(
      takesSteer(running({ credentialScopes: scopes }), turn({ credentialScopes: ['bots:write'] })),
    ).toBe(false);
  });

  it('steers no turn that is not yours, and none that is not running', () => {
    expect(takesSteer(running({ lane: 'background' }), turn())).toBe(false);
    expect(takesSteer(running({ status: 'completed' }), turn())).toBe(false);
    expect(takesSteer(running({ botId: randomUUID() }), turn())).toBe(false);
  });
});
