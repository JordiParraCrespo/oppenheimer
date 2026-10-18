import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import type { TurnCredentialsPort } from '../../../bots/application/turn-credentials.port';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BotModelAccessResolver } from '../bot-model-access.resolver';

/**
 * The one place a bot's model call gets its bot and its credential, for a
 * turn and for a summary alike: the bot in the run's workspace, and the
 * credential its provider runs on through `TurnCredentialsPort` (a key, or a
 * sign-in with its account). A turn is refused with the catalog code; a
 * summary is skipped. That a bot of another workspace is never read is the
 * integration spec's; how a key or a sign-in is opened is the credentials
 * resolver's.
 */
const NOW = new Date('2026-10-15T09:00:00Z');

function setup(
  options: {
    bot?: boolean;
    credential?: 'key' | 'sign-in' | 'none' | 'fault';
    model?: string | null;
  } = {},
) {
  const bot = { id: 'bot-1', provider: 'glm', model: options.model ?? null };
  const forTurn = vi.fn<TurnCredentialsPort['forTurn']>(async () => {
    switch (options.credential ?? 'key') {
      case 'none':
        throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
      case 'fault':
        throw new Error('database down');
      case 'sign-in':
        return { apiKey: 'access-token', accountId: 'acct-1' };
      default:
        return { apiKey: 'opened-key' };
    }
  });
  return {
    forTurn,
    access: new BotModelAccessResolver(
      {
        findForTurn: async () => (options.bot === false ? None : Some(bot)),
      } as unknown as BotRepositoryPort,
      { forTurn, has: async () => true },
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

  it('asks the credentials port for the provider asked, and passes its BOTS_013 on', async () => {
    const { access, forTurn } = setup();
    expect(await access.credential('org-1', 'anthropic', NOW)).toEqual({ apiKey: 'opened-key' });
    expect(forTurn).toHaveBeenCalledWith('org-1', 'anthropic', NOW);
    await expect(
      setup({ credential: 'none' }).access.credential('org-1', 'glm', NOW),
    ).rejects.toMatchObject({ code: 'BOTS_013' });
  });

  it('gives a summary the bot’s own provider, its model or the default, and its credential', async () => {
    expect(await setup({ model: 'glm-4.6' }).access.ownModel('org-1', 'bot-1', NOW)).toEqual({
      provider: 'glm',
      model: 'glm-4.6',
      apiKey: 'opened-key',
    });
    const fallback = await setup().access.ownModel('org-1', 'bot-1', NOW);
    expect(fallback?.model).toBeTruthy();
    expect(
      await setup({ credential: 'sign-in' }).access.ownModel('org-1', 'bot-1', NOW),
    ).toMatchObject({ apiKey: 'access-token', accountId: 'acct-1' });
  });

  it('gives a summary nothing when the bot is gone or has no credential, and fails on anything else', async () => {
    for (const options of [{ bot: false }, { credential: 'none' as const }]) {
      expect(await setup(options).access.ownModel('org-1', 'bot-1', NOW)).toBeNull();
    }
    await expect(
      setup({ credential: 'fault' }).access.ownModel('org-1', 'bot-1', NOW),
    ).rejects.toThrow('database down');
  });
});
