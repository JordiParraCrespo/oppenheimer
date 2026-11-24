/**
 * `check_back` over its ports: a call outside a look starts a chain named by
 * its turn, a call in a look's own turn goes on with that chain, a second call
 * in one turn sets nothing more, a chain past its day is refused, and the look
 * carries the calling turn's scopes and zone. The backoff and horizon numbers
 * are `bot-check-back.policy.spec.ts`.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotTurnOrigin } from '@oppenheimer/shared';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotCheckBacksPort } from '../../infrastructure/bot-check-backs.port';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotCheckBackToolsFactory } from '../bot-check-back-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

const ABOUT = 'pull request #42 of acme/api: merge once checks pass';

function lookOpening(step: number, chainStartedAt: Date): BotMessageEntity {
  return BotMessageEntity.createNew({
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-2',
    role: 'event',
    content: 'Checking back.',
    event: {
      kind: 'check_back',
      chainId: 'turn-1',
      step,
      chainStartedAt: chainStartedAt.toISOString(),
      about: ABOUT,
    },
    steps: [],
    position: 0,
  });
}

function setup(options: { origin?: BotTurnOrigin; opening?: BotMessageEntity | null } = {}) {
  const messages = {
    findOpening: vi.fn<BotMessageRepositoryPort['findOpening']>(
      async () => options.opening ?? null,
    ),
  } satisfies Partial<BotMessageRepositoryPort>;
  const checkBacks = { schedule: vi.fn<BotCheckBacksPort['schedule']>(async () => undefined) };
  const factory = new BotCheckBackToolsFactory(
    messages as unknown as BotMessageRepositoryPort,
    checkBacks,
  );
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    conversationId: 'bot-1',
    turnId: options.origin === 'check_back' ? 'turn-2' : 'turn-1',
    homeHostId: null,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals: { request: vi.fn<BotApprovalRequesterPort['request']>() },
    budget: new BotTurnBudget(),
    credentialScopes: ['bots:write'],
    origin: options.origin ?? 'message',
  };
  const [tool] = factory.definitions();
  const bound = tool.bind(context);
  const call = (input: unknown) => bound.run(input, { signal: new AbortController().signal });
  return { messages, checkBacks, tool, call };
}

describe('BotCheckBackToolsFactory', () => {
  it('never asks: it only wakes the bot', () => {
    const { tool } = setup();
    expect(tool.asks).toBeFalsy();
  });

  // What breaks this: the bot says "I'll verify before calling it done" and
  // nothing ever wakes it (Oppie's release, 2026-11-23).
  it('starts a chain named by the calling turn, with its scopes and zone', async () => {
    const { checkBacks, messages, call } = setup();
    const before = Date.now();
    const result = await call({ about: ABOUT });
    expect(result.isError).toBe(false);
    expect(result.content).toContain('look 1');
    expect(messages.findOpening).not.toHaveBeenCalled();
    const [look] = checkBacks.schedule.mock.calls[0];
    expect(look).toMatchObject({
      botId: 'bot-1',
      organizationId: 'org-1',
      originTurnId: 'turn-1',
      chainId: 'turn-1',
      step: 0,
      about: ABOUT,
      credentialScopes: ['bots:write'],
      timeZone: 'Europe/Madrid',
    });
    expect(look.at.getTime() - before).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
  });

  // What breaks this: a look's own call starting a new chain, so the looks
  // never back off and never stop.
  it("goes on with the look's chain from a look's own turn", async () => {
    const started = new Date(Date.now() - 60 * 60_000);
    const { checkBacks, call } = setup({
      origin: 'check_back',
      opening: lookOpening(1, started),
    });
    await call({ about: 'still waiting on checks' });
    expect(checkBacks.schedule.mock.calls[0][0]).toMatchObject({
      chainId: 'turn-1',
      step: 2,
      chainStartedAt: started,
      originTurnId: 'turn-2',
      about: 'still waiting on checks',
    });
  });

  it('sets one look a turn, and a second call says when the first is', async () => {
    const { checkBacks, call } = setup();
    const first = await call({ about: ABOUT, minutes: 30 });
    const second = await call({ about: 'something else', minutes: 5 });
    expect(checkBacks.schedule).toHaveBeenCalledTimes(1);
    expect(second.isError).toBe(false);
    expect(second.content).toContain('already set a look for this turn');
    const at = first.content.match(/look at it at (.+) \(look/)?.[1];
    expect(at && second.content).toContain(at);
  });

  // What breaks this: a bot that keeps looking at a stuck thing forever and
  // never tells the person it gave up.
  it("refuses a look past the chain's day, telling the bot to tell the person", async () => {
    const { checkBacks, call } = setup({
      origin: 'check_back',
      opening: lookOpening(14, new Date(Date.now() - 23.5 * 60 * 60_000)),
    });
    const result = await call({ about: ABOUT });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Tell the person');
    expect(checkBacks.schedule).not.toHaveBeenCalled();
  });
});
