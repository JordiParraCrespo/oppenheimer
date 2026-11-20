import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotSuggestionResolver } from '../../../application/bot-suggestion.resolver';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../../../domain/bot-message.entity';
import type { SuggestionMessage } from '../../../domain/bot-suggestion.policy';
import type { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { FindBotSuggestionQuery } from '../find-bot-suggestion.query';
import { FindBotSuggestionQueryHandler } from '../find-bot-suggestion.query-handler';

/**
 * When the composer gets a suggestion at all: never while a turn runs or
 * before the bot answered, and always from the console chat's own
 * conversation, never a channel's. The model, the cache and the spend are
 * `BotSuggestionResolver`'s spec.
 */
const scope = { organizationId: 'org-1' } as AccessScope;
const answered: SuggestionMessage[] = [
  { id: 'm-1', role: 'user', content: 'run the tests' },
  { id: 'm-2', role: 'assistant', content: 'All green. Open the pull request?' },
];

function setup(options: { recent?: SuggestionMessage[]; running?: boolean } = {}) {
  const recent = options.recent ?? answered;
  const bot = { organizationId: 'org-1', id: 'bot-1' };
  const lookup = {
    bot: vi.fn(async () => bot as unknown as Awaited<ReturnType<BotLookupPort['bot']>>),
  } satisfies BotLookupPort;
  const turns = {
    findRunningIn: vi.fn(async () => (options.running ? ({} as BotTurnEntity) : null)),
  } satisfies Pick<BotTurnRepositoryPort, 'findRunningIn'>;
  const messages = {
    findConversation: vi.fn(async () => recent as unknown as BotMessageEntity[]),
  } satisfies Pick<BotMessageRepositoryPort, 'findConversation'>;
  const suggestions = {
    suggest: vi.fn(async () => 'yes, open the pull request'),
  } satisfies Pick<BotSuggestionResolver, 'suggest'>;
  const handler = new FindBotSuggestionQueryHandler(
    lookup,
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    suggestions as unknown as BotSuggestionResolver,
  );
  const run = () => handler.execute(new FindBotSuggestionQuery(scope, 'bot-1'));
  return { run, messages, suggestions, bot };
}

describe('FindBotSuggestionQueryHandler', () => {
  it('suggests an answer to the bot’s last message in the console chat', async () => {
    const { run, messages, suggestions, bot } = setup();
    await expect(run()).resolves.toBe('yes, open the pull request');
    expect(messages.findConversation).toHaveBeenCalledWith(scope, 'bot-1', expect.any(Number));
    expect(suggestions.suggest).toHaveBeenCalledWith(bot, answered, answered[1]);
  });

  it('suggests nothing, and asks for none, while a turn runs', async () => {
    const { run, suggestions } = setup({ running: true });
    await expect(run()).resolves.toBeNull();
    expect(suggestions.suggest).not.toHaveBeenCalled();
  });

  it('suggests nothing, and asks for none, before the bot has answered', async () => {
    const { run, suggestions } = setup({
      recent: [
        { id: 'm-1', role: 'assistant', content: 'Hi.' },
        { id: 'm-2', role: 'user', content: 'deploy it' },
      ],
    });
    await expect(run()).resolves.toBeNull();
    expect(suggestions.suggest).not.toHaveBeenCalled();
  });
});
