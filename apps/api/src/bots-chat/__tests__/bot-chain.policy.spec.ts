import { BOT_CHAIN_LIMITS, checkBotChain } from '../domain/bot-chain.policy';

/**
 * `BotChainPolicy`'s whole decision table (`25-bots.md` §4.6): the four
 * refusals at their edges, and the call that passes them all. The chain's
 * state is read under its lock by the repository (the integration spec);
 * here it is given.
 */
const asker = { botId: 'ada', chainDepth: 0 };
const fresh = { bots: ['ada'], asks: 0 };

describe('checkBotChain', () => {
  it('lets a bot ask another bot the chain has not reached yet', () => {
    expect(checkBotChain(asker, 'grace', fresh)).toEqual({ allowed: true });
  });

  it('refuses a bot messaging itself, whatever else the chain allows', () => {
    const verdict = checkBotChain(asker, 'ada', { bots: [], asks: 0 });
    expect(verdict).toMatchObject({ allowed: false, refusal: expect.stringContaining('yourself') });
  });

  it('lets the last bot of a full-depth chain be reached, and refuses one more', () => {
    const atTwo = { botId: 'b', chainDepth: BOT_CHAIN_LIMITS.maxDepth - 1 };
    expect(checkBotChain(atTwo, 'c', { bots: ['a', 'b'], asks: 2 })).toEqual({ allowed: true });
    const atThree = { botId: 'c', chainDepth: BOT_CHAIN_LIMITS.maxDepth };
    expect(checkBotChain(atThree, 'd', { bots: ['a', 'b', 'c'], asks: 3 })).toMatchObject({
      allowed: false,
      refusal: expect.stringContaining(`${BOT_CHAIN_LIMITS.maxDepth} bots deep`),
    });
  });

  it('spends the budget to its last turn, then refuses', () => {
    const last = { bots: ['ada'], asks: BOT_CHAIN_LIMITS.turnBudget - 1 };
    expect(checkBotChain(asker, 'grace', last)).toEqual({ allowed: true });
    const spent = { bots: ['ada'], asks: BOT_CHAIN_LIMITS.turnBudget };
    expect(checkBotChain(asker, 'grace', spent)).toMatchObject({
      allowed: false,
      refusal: expect.stringContaining(`(${BOT_CHAIN_LIMITS.turnBudget})`),
    });
  });

  it('refuses a bot already in the chain, the one your message went to included', () => {
    const grace = { botId: 'grace', chainDepth: 1 };
    const verdict = checkBotChain(grace, 'ada', { bots: ['ada', 'grace'], asks: 1 });
    expect(verdict).toMatchObject({ allowed: false, refusal: expect.stringContaining('circle') });
  });

  it('reads its limits as given, so a caller can hold a tighter chain', () => {
    const tight = { maxDepth: 1, turnBudget: 1 };
    expect(checkBotChain(asker, 'grace', fresh, tight)).toEqual({ allowed: true });
    expect(checkBotChain(asker, 'grace', { bots: ['ada'], asks: 1 }, tight).allowed).toBe(false);
    expect(checkBotChain({ botId: 'grace', chainDepth: 1 }, 'hopper', fresh, tight).allowed).toBe(
      false,
    );
  });
});
