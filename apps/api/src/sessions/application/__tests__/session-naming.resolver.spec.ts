import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import type { SessionNamerPort } from '../../infrastructure/session-namer.port';
import { SessionNamingResolver } from '../session-naming.resolver';

/**
 * Model first, the prompt's own words when the model is not there or not quick:
 * either way a session with a first prompt stops being called by its slug.
 */
function session(nameSource: 'user' | 'model' | 'prompt' | null = null): WorkSessionEntity {
  return { slug: 'bold-otter-3f9a7k', nameSource } as WorkSessionEntity;
}

function namer(nameFor: SessionNamerPort['nameFor']): SessionNamerPort {
  return { isConfigured: () => true, nameFor: vi.fn(nameFor) } as unknown as SessionNamerPort;
}

function repository(): WorkSessionRepositoryPort {
  return { appendEvents: vi.fn().mockResolvedValue({}) } as unknown as WorkSessionRepositoryPort;
}

describe('SessionNamingResolver', () => {
  it('takes the model’s title when it answers in time', async () => {
    const resolver = new SessionNamingResolver(
      repository(),
      namer(async () => 'Wallet empty state'),
    );
    await expect(resolver.propose(session(), 'fix the wallet list')).resolves.toEqual({
      name: 'Wallet empty state',
      source: 'model',
    });
  });

  it('falls back to the prompt’s own words when the model has nothing', async () => {
    // `null` is what the namer answers for a timeout, a refusal or no provider.
    const resolver = new SessionNamingResolver(
      repository(),
      namer(async () => null),
    );
    await expect(
      resolver.propose(session(), 'can you fix the wallet list empty state on mobile please'),
    ).resolves.toEqual({ name: 'Fix the wallet list empty state', source: 'prompt' });
  });

  it('falls back even when a namer breaks its promise and throws', async () => {
    const resolver = new SessionNamingResolver(
      repository(),
      namer(async () => {
        throw new Error('boom');
      }),
    );
    await expect(resolver.propose(session(), 'add dark mode')).resolves.toEqual({
      name: 'Add dark mode',
      source: 'prompt',
    });
  });

  it('proposes nothing for a session somebody already named', async () => {
    const nameFor = namer(async () => 'never');
    const resolver = new SessionNamingResolver(repository(), nameFor);
    await expect(resolver.propose(session('user'), 'add dark mode')).resolves.toBeNull();
    expect(nameFor.nameFor).not.toHaveBeenCalled();
  });

  it('records the proposal with who chose it, keyed on the prompt', async () => {
    const sessions = repository();
    const resolver = new SessionNamingResolver(
      sessions,
      namer(async () => null),
    );

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
    const resolver = new SessionNamingResolver(
      sessions,
      namer(async () => null),
    );

    await expect(
      resolver.record(session(), { name: 'Add dark mode', source: 'prompt' }, 'k'),
    ).resolves.toBeUndefined();
  });
});
