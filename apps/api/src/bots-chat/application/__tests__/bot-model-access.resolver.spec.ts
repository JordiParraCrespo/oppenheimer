import { None, Some } from 'oxide.ts';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../../bots/database/model-provider-credential.repository.port';
import type { ProviderKeySealerPort } from '../../../bots/infrastructure/provider-key-sealer.port';
import { BotModelAccessResolver } from '../bot-model-access.resolver';

/**
 * The one place a bot's model call gets its bot and its key, for a turn and
 * for a summary alike: the bot in the run's workspace, the workspace's key
 * for the provider, opened, and closed when there is no key or no sealer to
 * open it. A turn is refused with the catalog code; a summary is skipped.
 * That a bot of another workspace is never read is the integration spec's.
 */
function setup(
  options: { bot?: boolean; key?: boolean; sealer?: boolean; model?: string | null } = {},
) {
  const bot = { id: 'bot-1', provider: 'glm', model: options.model ?? null };
  const findForRun = vi.fn(async () =>
    options.key === false ? None : Some({ sealedKey: Buffer.from('sealed') }),
  );
  return {
    findForRun,
    access: new BotModelAccessResolver(
      {
        findForTurn: async () => (options.bot === false ? None : Some(bot)),
      } as unknown as BotRepositoryPort,
      { findForRun } as unknown as ModelProviderCredentialRepositoryPort,
      {
        isConfigured: () => options.sealer !== false,
        open: () => 'opened-key',
      } as unknown as ProviderKeySealerPort,
    ),
  };
}

describe('BotModelAccessResolver', () => {
  it('reads the bot, and refuses a gone one with BOTS_001', async () => {
    expect(await setup().access.bot('org-1', 'bot-1')).toMatchObject({ id: 'bot-1' });
    await expect(setup({ bot: false }).access.bot('org-1', 'bot-1')).rejects.toMatchObject({
      code: 'BOTS_001',
    });
  });

  it('opens the workspace’s key for the provider asked, and refuses with BOTS_013 when it cannot', async () => {
    const { access, findForRun } = setup();
    expect(await access.apiKey('org-1', 'anthropic')).toBe('opened-key');
    expect(findForRun).toHaveBeenCalledWith('org-1', 'anthropic');
    for (const options of [{ key: false }, { sealer: false }]) {
      await expect(setup(options).access.apiKey('org-1', 'glm')).rejects.toMatchObject({
        code: 'BOTS_013',
      });
    }
  });

  it('gives a summary the bot’s own provider, its model or the default, and the key', async () => {
    expect(await setup({ model: 'glm-4.6' }).access.ownModel('org-1', 'bot-1')).toEqual({
      provider: 'glm',
      model: 'glm-4.6',
      apiKey: 'opened-key',
    });
    const fallback = await setup().access.ownModel('org-1', 'bot-1');
    expect(fallback?.model).toBeTruthy();
  });

  it('gives a summary nothing when the bot is gone or the key cannot be opened', async () => {
    for (const options of [{ bot: false }, { key: false }, { sealer: false }]) {
      expect(await setup(options).access.ownModel('org-1', 'bot-1')).toBeNull();
    }
  });
});
