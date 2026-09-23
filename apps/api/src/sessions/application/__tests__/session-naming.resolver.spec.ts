import type { ConfigService } from '@nestjs/config';
import { LlmError, type LlmService } from '@oppenheimer/backend-llm';
import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionNamingResolver } from '../session-naming.resolver';

/**
 * Model first, the prompt's own words when the model is not there or not quick:
 * either way a session with a first prompt stops being called by its slug.
 */
function session(nameSource: 'user' | 'model' | 'prompt' | null = null): WorkSessionEntity {
  return { slug: 'bold-otter-3f9a7k', nameSource } as WorkSessionEntity;
}

function llm(
  complete: LlmService['complete'],
  { configured = true, defaultModel = 'default-model' } = {},
): LlmService {
  return {
    isConfigured: () => configured,
    defaultModel,
    complete: vi.fn(complete),
  } as unknown as LlmService;
}

const answer = (text: string) => async () => ({
  text,
  model: 'a-small-model',
  provider: 'openrouter' as const,
  finishReason: 'stop',
  usage: null,
});

function config(values: Record<string, unknown> = {}): ConfigService {
  const all: Record<string, unknown> = { 'sessions.namerTimeoutMs': 1_500, ...values };
  return { get: (key: string) => all[key] } as ConfigService;
}

function repository(): WorkSessionRepositoryPort {
  return { appendEvents: vi.fn().mockResolvedValue({}) } as unknown as WorkSessionRepositoryPort;
}

const resolverWith = (client: LlmService, values?: Record<string, unknown>) =>
  new SessionNamingResolver(repository(), client, config(values));

describe('SessionNamingResolver.propose', () => {
  it('takes the model’s title, asked within the naming deadline', async () => {
    const client = llm(answer('<think>ok</think>\n"Wallet empty state."'));

    await expect(
      resolverWith(client, { 'sessions.namerModel': 'a-small-model' }).propose(
        session(),
        'the wallet list shows nothing when there are no wallets',
      ),
    ).resolves.toEqual({ name: 'Wallet empty state', source: 'model' });

    expect(client.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'a-small-model',
        timeoutMs: 1_500,
        temperature: 0,
        messages: [
          { role: 'user', content: 'the wallet list shows nothing when there are no wallets' },
        ],
      }),
    );
  });

  it('asks the provider’s default model when naming names none of its own', async () => {
    const client = llm(answer('A title'));
    await resolverWith(client).propose(session(), 'anything');
    expect(vi.mocked(client.complete).mock.calls[0][0].model).toBe('default-model');
  });

  it('falls back to the prompt’s own words when the model is not quick', async () => {
    const client = llm(async () => {
      throw new LlmError('timeout', 'openrouter', 'openrouter did not answer within 1500ms');
    });
    await expect(
      resolverWith(client).propose(
        session(),
        'can you fix the wallet list empty state on mobile please',
      ),
    ).resolves.toEqual({ name: 'Fix the wallet list empty state', source: 'prompt' });
  });

  it('falls back when the model answers with nothing usable', async () => {
    await expect(
      resolverWith(llm(answer('<think>hmm</think>'))).propose(session(), 'add dark mode'),
    ).resolves.toEqual({ name: 'Add dark mode', source: 'prompt' });
  });

  it('makes no call when no model names sessions here', async () => {
    const unconfigured = llm(answer('never'), { configured: false });
    await expect(resolverWith(unconfigured).propose(session(), 'add dark mode')).resolves.toEqual({
      name: 'Add dark mode',
      source: 'prompt',
    });
    expect(unconfigured.complete).not.toHaveBeenCalled();

    const noModel = llm(answer('never'), { defaultModel: '' });
    await resolverWith(noModel).propose(session(), 'add dark mode');
    expect(noModel.complete).not.toHaveBeenCalled();
  });

  it('proposes nothing for a session somebody already named', async () => {
    const client = llm(answer('never'));
    await expect(
      resolverWith(client).propose(session('user'), 'add dark mode'),
    ).resolves.toBeNull();
    expect(client.complete).not.toHaveBeenCalled();
  });
});

describe('SessionNamingResolver.record', () => {
  it('records the proposal with who chose it, keyed on the prompt', async () => {
    const sessions = repository();
    const resolver = new SessionNamingResolver(sessions, llm(answer('x')), config());

    await resolver.record(session(), { name: 'Add dark mode', source: 'prompt' }, 'cmd-1:prompt');

    expect(sessions.appendEvents).toHaveBeenCalledWith(expect.anything(), [
      {
        idempotencyKey: 'session.named:cmd-1:prompt',
        source: 'api',
        kind: 'session.named',
        payload: { name: 'Add dark mode', source: 'prompt' },
      },
    ]);
  });

  it('never fails the caller over a name it could not write', async () => {
    const sessions = repository();
    vi.mocked(sessions.appendEvents).mockRejectedValue(new Error('lock timeout'));
    const resolver = new SessionNamingResolver(sessions, llm(answer('x')), config());

    await expect(
      resolver.record(session(), { name: 'Add dark mode', source: 'prompt' }, 'k'),
    ).resolves.toBeUndefined();
  });
});
