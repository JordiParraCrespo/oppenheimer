import { type AccessScope, emptyScope } from '@oppenheimer/backend-authz';
import { WORKSPACE_BOT_NOTICES_MAX } from '@oppenheimer/shared';
import type { BotRepositoryPort } from '../../../../bots/database/bot.repository.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotNoticeRepositoryPort } from '../../../database/bot-notice.repository.port';
import { BotNoticeEntity } from '../../../domain/bot-notice.entity';
import { FindWorkspaceBotNoticesQuery } from '../find-workspace-bot-notices.query';
import { FindWorkspaceBotNoticesQueryHandler } from '../find-workspace-bot-notices.query-handler';

/**
 * The Inbox's lines from bots (`agent-tools.md` §5): both reads go through
 * the caller's scope, each notice carries its bot's name, and a notice whose
 * bot the caller cannot read is left out rather than shown nameless. The SQL
 * (order, workspace, upsert) is the integration suite's.
 */
const scope: AccessScope = emptyScope('user-1', 'org-1');

const notice = (botId: string) =>
  BotNoticeEntity.send({ organizationId: 'org-1', botId, text: 'Done.' });

function setup(found: BotNoticeEntity[], bots: { id: string; name: string }[]) {
  const notices: Pick<BotNoticeRepositoryPort, 'findInWorkspace'> = {
    findInWorkspace: vi.fn(async () => found),
  };
  const botRepo: Pick<BotRepositoryPort, 'findAll'> = {
    findAll: vi.fn(async () => bots as unknown as BotEntity[]),
  };
  const handler = new FindWorkspaceBotNoticesQueryHandler(
    botRepo as BotRepositoryPort,
    notices as BotNoticeRepositoryPort,
  );
  return { handler, notices, botRepo };
}

describe('FindWorkspaceBotNoticesQueryHandler', () => {
  it("names each notice's bot, in the order the store read them, through the caller's scope", async () => {
    const ops = notice('bot-ops');
    const docs = notice('bot-docs');
    const { handler, notices, botRepo } = setup(
      [ops, docs],
      [
        { id: 'bot-docs', name: 'Docs' },
        { id: 'bot-ops', name: 'Ops' },
      ],
    );

    await expect(handler.execute(new FindWorkspaceBotNoticesQuery(scope))).resolves.toEqual([
      { notice: ops, botName: 'Ops' },
      { notice: docs, botName: 'Docs' },
    ]);
    expect(notices.findInWorkspace).toHaveBeenCalledWith(scope, WORKSPACE_BOT_NOTICES_MAX);
    expect(botRepo.findAll).toHaveBeenCalledWith(scope);
  });

  it('leaves out a notice whose bot the caller cannot read', async () => {
    const { handler } = setup(
      [notice('bot-hidden'), notice('bot-ops')],
      [{ id: 'bot-ops', name: 'Ops' }],
    );
    const found = await handler.execute(new FindWorkspaceBotNoticesQuery(scope));
    expect(found.map(({ botName }) => botName)).toEqual(['Ops']);
  });
});
