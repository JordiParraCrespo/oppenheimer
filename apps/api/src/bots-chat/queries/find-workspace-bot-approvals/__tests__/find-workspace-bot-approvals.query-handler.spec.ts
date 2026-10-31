import { WORKSPACE_BOT_APPROVALS_MAX } from '@oppenheimer/shared';
import { type AccessScope, emptyScope } from '../../../../authz/domain/access-scope.types';
import type { BotRepositoryPort } from '../../../../bots/database/bot.repository.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotApprovalRepositoryPort } from '../../../database/bot-approval.repository.port';
import { BotApprovalEntity } from '../../../domain/bot-approval.entity';
import { FindWorkspaceBotApprovalsQuery } from '../find-workspace-bot-approvals.query';
import { FindWorkspaceBotApprovalsQueryHandler } from '../find-workspace-bot-approvals.query-handler';

/**
 * The Inbox's pending approvals across bots (`29-inbox.md` §4): both reads go
 * through the caller's scope, each card carries its bot's name, and a card
 * whose bot the caller cannot see is left out rather than shown nameless.
 * The SQL (status, order, workspace) is the integration suite's.
 */
const scope: AccessScope = emptyScope('user-1', 'org-1');

function approval(botId: string) {
  return BotApprovalEntity.request({
    organizationId: 'org-1',
    botId,
    turnId: 'turn-1',
    tool: 'start_session',
    input: {},
    summary: 'Start a session',
  });
}

function setup(found: BotApprovalEntity[], bots: { id: string; name: string }[]) {
  const approvals: Pick<BotApprovalRepositoryPort, 'findInWorkspace'> = {
    findInWorkspace: vi.fn(async () => found),
  };
  const botRepo: Pick<BotRepositoryPort, 'findAll'> = {
    findAll: vi.fn(async () => bots as unknown as BotEntity[]),
  };
  const handler = new FindWorkspaceBotApprovalsQueryHandler(
    botRepo as BotRepositoryPort,
    approvals as BotApprovalRepositoryPort,
  );
  return { handler, approvals, botRepo };
}

describe('FindWorkspaceBotApprovalsQueryHandler', () => {
  it("names each card's bot, in the order the store read them, through the caller's scope", async () => {
    const ops = approval('bot-ops');
    const docs = approval('bot-docs');
    const { handler, approvals, botRepo } = setup(
      [ops, docs],
      [
        { id: 'bot-docs', name: 'Docs' },
        { id: 'bot-ops', name: 'Ops' },
      ],
    );

    const found = await handler.execute(new FindWorkspaceBotApprovalsQuery(scope, 'pending'));

    expect(found).toEqual([
      { approval: ops, botName: 'Ops' },
      { approval: docs, botName: 'Docs' },
    ]);
    expect(approvals.findInWorkspace).toHaveBeenCalledWith(
      scope,
      'pending',
      WORKSPACE_BOT_APPROVALS_MAX,
    );
    expect(botRepo.findAll).toHaveBeenCalledWith(scope);
  });

  it('leaves out a card whose bot the caller cannot read', async () => {
    const { handler } = setup([approval('bot-hidden')], [{ id: 'bot-ops', name: 'Ops' }]);
    await expect(
      handler.execute(new FindWorkspaceBotApprovalsQuery(scope, 'pending')),
    ).resolves.toEqual([]);
  });
});
