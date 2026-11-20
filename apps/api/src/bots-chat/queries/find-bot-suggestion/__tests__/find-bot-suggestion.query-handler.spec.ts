import type { BotTurnRequest } from '@oppenheimer/backend-agents';
import { FakeBotEngine } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { CacheService } from '@oppenheimer/backend-cache';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import { BotCompletionResolver } from '../../../application/bot-completion.resolver';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../../../domain/bot-message.entity';
import {
  BOT_SUGGESTER_PROMPT,
  type SuggestionMessage,
} from '../../../domain/bot-suggestion.policy';
import type { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { FindBotSuggestionQuery } from '../find-bot-suggestion.query';
import { FindBotSuggestionQueryHandler } from '../find-bot-suggestion.query-handler';

/**
 * The composer's suggestion: asked of the bot's own model, with no tools,
 * once per message of the bot's it answers (the cache), its spend recorded as
 * `suggestion`; none while a turn runs, before the bot answered, with no key,
 * or when the model fails. The policy's spec covers what is sent and shown.
 */
const scope = { organizationId: 'org-1' } as AccessScope;

function setup(
  options: {
    recent?: SuggestionMessage[];
    running?: boolean;
    target?: boolean;
    answer?: string;
    fails?: boolean;
  } = {},
) {
  const requests: BotTurnRequest[] = [];
  const engine = new FakeBotEngine((request) => {
    requests.push(request);
    if (options.fails) return [{ type: 'done', reason: 'failed', error: 'upstream down' }];
    return [{ type: 'text.done', text: options.answer ?? 'yes, open the pull request' }];
  });
  const recordCall = vi.fn(async () => undefined);
  const recent = options.recent ?? [
    { id: 'm-1', role: 'user', content: 'run the tests' },
    { id: 'm-2', role: 'assistant', content: 'All green. Open the pull request?' },
  ];
  const kept = new Map<string, unknown>();
  const cache = {
    getOrSet: async <T>(key: string, _ttl: number, load: () => Promise<T>): Promise<T> => {
      if (!kept.has(key)) kept.set(key, await load());
      return kept.get(key) as T;
    },
  } satisfies Pick<CacheService, 'getOrSet'>;
  const handler = new FindBotSuggestionQueryHandler(
    {
      bot: vi.fn(async () => ({ organizationId: 'org-1', id: 'bot-1' })),
    } as unknown as BotLookupPort,
    {
      findRunningIn: vi.fn(async () => (options.running ? ({} as BotTurnEntity) : null)),
    } satisfies Pick<BotTurnRepositoryPort, 'findRunningIn'> as unknown as BotTurnRepositoryPort,
    {
      findRecent: vi.fn(async () => recent as unknown as BotMessageEntity[]),
    } satisfies Pick<BotMessageRepositoryPort, 'findRecent'> as unknown as BotMessageRepositoryPort,
    {
      ownModel: vi.fn(async () =>
        options.target === false
          ? null
          : { provider: 'glm' as const, model: 'glm-5.3', apiKey: 'workspace-key' },
      ),
    } satisfies Pick<BotModelAccessResolver, 'ownModel'> as unknown as BotModelAccessResolver,
    new BotCompletionResolver(engine, { recordCall, findForBot: vi.fn() }),
    cache as unknown as CacheService,
  );
  const run = () => handler.execute(new FindBotSuggestionQuery(scope, 'bot-1'));
  return { run, requests, kept };
}

describe('FindBotSuggestionQueryHandler', () => {
  it('asks the bot’s own model, with no tools, for the person’s next message', async () => {
    const { run, requests } = setup();
    await expect(run()).resolves.toBe('yes, open the pull request');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      provider: 'glm',
      model: 'glm-5.3',
      apiKey: 'workspace-key',
      systemPrompt: BOT_SUGGESTER_PROMPT,
      tools: [],
    });
    expect(requests[0].message).toContain('All green. Open the pull request?');
  });

  it('asks once per message of the bot’s, however often the composer reads it', async () => {
    const { run, requests, kept } = setup();
    await run();
    await expect(run()).resolves.toBe('yes, open the pull request');
    expect(requests).toHaveLength(1);
    expect([...kept.keys()]).toEqual(['bot-suggestion:org-1:bot-1:m-2']);
  });

  it('suggests nothing, and calls no model, while a turn runs or before the bot answered', async () => {
    const running = setup({ running: true });
    await expect(running.run()).resolves.toBeNull();
    expect(running.requests).toHaveLength(0);

    const waiting = setup({
      recent: [
        { id: 'm-1', role: 'assistant', content: 'Hi.' },
        { id: 'm-2', role: 'user', content: 'deploy it' },
      ],
    });
    await expect(waiting.run()).resolves.toBeNull();
    expect(waiting.requests).toHaveLength(0);
  });

  it('suggests nothing when the bot’s provider has no credential', async () => {
    const { run, requests } = setup({ target: false });
    await expect(run()).resolves.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('suggests nothing when the model says NONE', async () => {
    await expect(setup({ answer: 'NONE' }).run()).resolves.toBeNull();
  });

  it('suggests nothing when the model fails, and keeps no answer, so the next read asks again', async () => {
    const { run, kept } = setup({ fails: true });
    await expect(run()).resolves.toBeNull();
    expect(kept.size).toBe(0);
  });
});
