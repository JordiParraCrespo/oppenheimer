/**
 * `check_back` as rules: when each look of a chain is due, when a chain
 * stops, which call goes on with a chain and which starts one, and what a
 * look's turn is keyed on and opens with. The tool over its ports is
 * `bot-check-back-tools.factory.spec.ts`; the wake is
 * `wake-on-check-back.command-handler.spec.ts`.
 */
import {
  BOT_CHECK_BACK_HORIZON_MS,
  checkBackChainOf,
  checkBackDelayMinutes,
  checkBackPrompt,
  checkBackTurn,
  planCheckBack,
} from '../domain/bot-check-back.policy';

const NOW = new Date('2026-11-23T10:00:00Z');
const MINUTE = 60_000;
const ABOUT = 'release session 3f2a: verify runner 0.1.21 is on dev stable with all four downloads';

describe('checkBackDelayMinutes', () => {
  // What breaks this: a bot woken every five minutes for a day on a deploy
  // that takes hours, or one whose looks drift so far apart it misses the end.
  it('backs off 5, 10, 20, 40, 80 minutes, then every 120', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 12].map(checkBackDelayMinutes)).toEqual([
      5, 10, 20, 40, 80, 120, 120, 120,
    ]);
  });
});

describe('planCheckBack', () => {
  it('starts a chain at step 0, named by the calling turn, due in five minutes', () => {
    const plan = planCheckBack({ about: ABOUT }, null, 'turn-1', NOW);
    expect(plan).toEqual({
      kind: 'set',
      look: {
        chainId: 'turn-1',
        step: 0,
        chainStartedAt: NOW,
        about: ABOUT,
        at: new Date(NOW.getTime() + 5 * MINUTE),
      },
    });
  });

  // What breaks this: a look's own call starting a fresh chain, so the backoff
  // restarts at five minutes every time and the 24 hours never run out.
  it("goes on with the look's chain at the next step and its delay, keeping when it started", () => {
    const started = new Date(NOW.getTime() - 3 * 60 * MINUTE);
    const plan = planCheckBack(
      { about: 'still signing the downloads' },
      { chainId: 'turn-1', step: 2, chainStartedAt: started },
      'turn-9',
      NOW,
    );
    expect(plan).toEqual({
      kind: 'set',
      look: {
        chainId: 'turn-1',
        step: 3,
        chainStartedAt: started,
        about: 'still signing the downloads',
        at: new Date(NOW.getTime() + 40 * MINUTE),
      },
    });
  });

  it('takes the minutes the bot gives over the backoff, and still counts the step', () => {
    const plan = planCheckBack(
      { about: ABOUT, minutes: 20 },
      { chainId: 'turn-1', step: 0, chainStartedAt: NOW },
      'turn-2',
      NOW,
    );
    expect(plan).toMatchObject({
      kind: 'set',
      look: { step: 1, at: new Date(NOW.getTime() + 20 * MINUTE) },
    });
  });

  // What breaks this: a chain that never ends, a bot looking at a stuck
  // thing every two hours forever without telling the person it gave up.
  it('refuses a look past 24 hours from the chain start, and allows one at the edge', () => {
    const started = new Date(NOW.getTime() - BOT_CHECK_BACK_HORIZON_MS + 120 * MINUTE);
    const chain = { chainId: 'turn-1', step: 9, chainStartedAt: started };
    expect(planCheckBack({ about: ABOUT }, chain, 'turn-9', NOW)).toMatchObject({ kind: 'set' });
    expect(planCheckBack({ about: ABOUT, minutes: 121 }, chain, 'turn-9', NOW)).toEqual({
      kind: 'past_horizon',
      chainStartedAt: started,
      at: new Date(NOW.getTime() + 121 * MINUTE),
    });
  });
});

describe('checkBackChainOf', () => {
  it("reads the chain from a look's opening event, and none from any other", () => {
    expect(
      checkBackChainOf({
        kind: 'check_back',
        chainId: 'turn-1',
        step: 2,
        chainStartedAt: NOW.toISOString(),
        about: ABOUT,
      }),
    ).toEqual({ chainId: 'turn-1', step: 2, chainStartedAt: NOW });
    expect(checkBackChainOf(null)).toBeNull();
    expect(
      checkBackChainOf({
        kind: 'dream',
        activity: 'dreamed',
        dreamId: 'd',
        factsBefore: 1,
        factsAfter: 1,
      }),
    ).toBeNull();
  });
});

describe('checkBackTurn', () => {
  it('queues a background turn keyed by the chain and step, opening with the look', () => {
    const { turn, opening } = checkBackTurn(
      {
        organizationId: 'org-1',
        botId: 'bot-1',
        requestedByUserId: 'owner-1',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        effort: null,
        timeZone: 'Europe/Madrid',
        credentialScopes: ['bots:write'],
      },
      { chainId: 'turn-1', step: 1, chainStartedAt: NOW, about: ABOUT },
    );
    expect(turn).toMatchObject({
      origin: 'check_back',
      lane: 'background',
      sourceKey: 'check_back:turn-1:1',
      timeZone: 'Europe/Madrid',
      credentialScopes: ['bots:write'],
    });
    expect(opening.event).toEqual({
      kind: 'check_back',
      chainId: 'turn-1',
      step: 1,
      chainStartedAt: NOW.toISOString(),
      about: ABOUT,
    });
    expect(opening.content).toContain('look 2');
    expect(opening.content).toContain(ABOUT);
  });

  // What breaks this: a look that wakes the bot without telling it to look,
  // to stay quiet when nothing moved, or to set the next look while pending.
  it('asks the bot to look, speak only when it moved, and call again only while pending', () => {
    const prompt = checkBackPrompt('Checking back.');
    expect(prompt).toContain('nothing_to_report');
    expect(prompt).toContain('call check_back again');
    expect(prompt).toContain('do not call check_back again');
  });
});
