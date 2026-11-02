import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotToolboxFactory } from '../../../application/bot-toolbox.factory';
import type { BotToolPermissionRepositoryPort } from '../../../database/bot-tool-permission.repository.port';
import type { BotToolPermissionEntity } from '../../../domain/bot-tool-permission.entity';
import { SetBotToolDecisionCommand } from '../set-bot-tool-decision.command';
import { SetBotToolDecisionCommandHandler } from '../set-bot-tool-decision.command-handler';

/**
 * Setting one tool's Allow, Ask or Off (`25-bots.md` §5). What breaks this:
 * a setting stored for a tool the catalog does not have; merging made
 * standing through Settings; `default` stored as a row rather than clearing
 * one. The upsert itself is the integration suite's.
 */
const scope = emptyScope('owner-1', 'org-1');
const bot = { id: 'bot-1', organizationId: 'org-1', permission: 'auto' } as BotEntity;
const listed = (name: string, perCallOnly = false) => ({
  group: 'github' as const,
  definition: { name, traits: { name, asks: true, perCallOnly } },
});

function setup() {
  const settings = {
    setDecision: vi.fn<BotToolPermissionRepositoryPort['setDecision']>(async () => 'saved'),
    clearDecision: vi.fn<BotToolPermissionRepositoryPort['clearDecision']>(async () => {}),
  };
  const toolbox = {
    listed: () => [listed('comment_on_pull_request'), listed('merge_pull_request', true)],
  };
  const handler = new SetBotToolDecisionCommandHandler(
    { bot: async () => bot } satisfies BotLookupPort,
    settings as unknown as BotToolPermissionRepositoryPort,
    toolbox as unknown as BotToolboxFactory,
  );
  const set = (tool: string, decision: SetBotToolDecisionCommand['decision']) =>
    handler.execute(new SetBotToolDecisionCommand({ scope, botId: bot.id, tool, decision }));
  return { settings, set };
}

describe('SetBotToolDecisionCommandHandler', () => {
  it('stores the owner’s decision for the tool, as theirs', async () => {
    const { settings, set } = setup();
    await set('comment_on_pull_request', 'off');
    const stored = settings.setDecision.mock.calls[0][0] as BotToolPermissionEntity;
    expect(stored.getProps()).toMatchObject({
      organizationId: 'org-1',
      botId: 'bot-1',
      tool: 'comment_on_pull_request',
      decision: 'off',
      subject: null,
      createdByUserId: 'owner-1',
    });
  });

  it('clears the setting on default, so the tool follows the preset again', async () => {
    const { settings, set } = setup();
    await set('comment_on_pull_request', 'default');
    expect(settings.clearDecision).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      'comment_on_pull_request',
    );
    expect(settings.setDecision).not.toHaveBeenCalled();
  });

  it('refuses a tool the catalog does not have with BOTS_029, storing nothing', async () => {
    const { settings, set } = setup();
    await expect(set('rm_rf', 'allow')).rejects.toMatchObject({ code: 'BOTS_029' });
    expect(settings.setDecision).not.toHaveBeenCalled();
  });

  it('refuses Allow for a tool decided call by call with BOTS_030, but takes Off', async () => {
    const { settings, set } = setup();
    await expect(set('merge_pull_request', 'allow')).rejects.toMatchObject({ code: 'BOTS_030' });
    expect(settings.setDecision).not.toHaveBeenCalled();
    await set('merge_pull_request', 'off');
    expect(settings.setDecision).toHaveBeenCalledTimes(1);
  });

  it('answers a bot deleted under it as BOTS_001', async () => {
    const { settings, set } = setup();
    settings.setDecision.mockResolvedValueOnce('missing');
    await expect(set('comment_on_pull_request', 'ask')).rejects.toMatchObject({ code: 'BOTS_001' });
  });
});
