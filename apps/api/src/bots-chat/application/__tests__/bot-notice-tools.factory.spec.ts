/**
 * `notify` (`product/next-steps/agent-tools.md` §5). What breaks this: a
 * notice stored under the bot's last id, so the Inbox's mark on the last one
 * hides the next; an empty or over-long line reaching the store; a notice
 * written without the event that tells the Inbox; the tool asking for a yes
 * the person was never meant to give; a turn that spams the Inbox. The
 * upsert itself is the integration suite's.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import { BOT_NOTICE_TEXT_MAX } from '@oppenheimer/shared';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import type { BotNoticeEntity } from '../../domain/bot-notice.entity';
import { BOT_NOTICES_PER_TURN } from '../../domain/bot-notice.policy';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotNoticeChangedDomainEvent } from '../../domain/events/bot-notice-changed.domain-event';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotNoticeToolsFactory } from '../bot-notice-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

function setup() {
  const stored: BotNoticeEntity[] = [];
  const notices: Pick<BotNoticeRepositoryPort, 'put'> = {
    put: vi.fn(async (notice: BotNoticeEntity) => {
      stored.push(notice);
    }),
  };
  const approvals = { request: vi.fn<BotApprovalRequesterPort['request']>() };
  const factory = new BotNoticeToolsFactory(notices as BotNoticeRepositoryPort);
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'UTC',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals,
    budget: new BotTurnBudget(),
    credentialScopes: null,
  };
  const [notify] = factory.definitions();
  const bound = notify.bind(context);
  const call = (input: unknown) => bound.run(input, { signal: new AbortController().signal });
  return { notices, stored, approvals, notify, call };
}

describe('BotNoticeToolsFactory', () => {
  it("stores the bot's line, trimmed, and announces it to the workspace", async () => {
    const { stored, call } = setup();
    const result = await call({ text: '  Release 1.4 is out; the changelog is in #42.  ' });

    expect(result.isError).toBe(false);
    expect(result.content).toContain("in the person's Inbox");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      organizationId: 'org-1',
      botId: 'bot-1',
      text: 'Release 1.4 is out; the changelog is in #42.',
    });
    const events = stored[0].domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(BotNoticeChangedDomainEvent);
    expect(events[0]).toMatchObject({ aggregateId: stored[0].id, botId: 'bot-1' });
  });

  // The regression: a notice that kept the last one's id, so a mark on it hid the next.
  it('gives each notice an id of its own, so the next replaces the last under a new key', async () => {
    const { stored, call } = setup();
    await call({ text: 'Tests pass.' });
    await call({ text: 'Deployed to staging.' });
    expect(stored.map((notice) => notice.text)).toEqual(['Tests pass.', 'Deployed to staging.']);
    expect(stored[0].id).not.toBe(stored[1].id);
  });

  it('refuses an empty or over-long line and stores nothing', async () => {
    const { notices, call } = setup();
    for (const text of ['', '   ', 'x'.repeat(BOT_NOTICE_TEXT_MAX + 1)]) {
      const result = await call({ text });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Invalid input');
    }
    expect(notices.put).not.toHaveBeenCalled();
  });

  it(`sends at most ${BOT_NOTICES_PER_TURN} notices a turn`, async () => {
    const { notices, call } = setup();
    for (let sent = 0; sent < BOT_NOTICES_PER_TURN; sent += 1) {
      expect((await call({ text: `Line ${sent}` })).isError).toBe(false);
    }
    const refused = await call({ text: 'One more' });
    expect(refused.isError).toBe(true);
    expect(refused.content).toContain('Not sent');
    expect(notices.put).toHaveBeenCalledTimes(BOT_NOTICES_PER_TURN);
  });

  it('never asks the owner first, and is offered on turns nobody is waiting on', async () => {
    const { notify, approvals, call } = setup();
    expect(notify.traits.asks).toBe(false);
    expect(notify.attendedOnly).toBe(false);
    await call({ text: 'Done.' });
    expect(approvals.request).not.toHaveBeenCalled();
  });
});
