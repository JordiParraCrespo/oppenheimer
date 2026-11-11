/**
 * The composer's optimistic save (`useUpdateBotOptimistically`): a pick shows
 * on the bot's detail before the API answers, and a refusal puts back what
 * that pick set and nothing else. The cache helpers the other bot mutations
 * share write in place, which `query-keys.spec.ts` and the screens cover.
 * A fact about the person is read by every bot of theirs, so a change to one
 * refreshes the other bots' memory too, and a bot's own fact only its own.
 */
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { BotEntity, BotMemoryFactEntity, type UpdateBotInput } from '../../modules/bots/bot.entity';
import type { BotsRepository } from '../../modules/bots/bots.repository';
import { botsKeys } from '../bots.keys';
import {
  useDeleteBotFact,
  useSuspenseBot,
  useUpdateBotFact,
  useUpdateBotOptimistically,
} from '../bots.queries';
import { fakeKernel } from './fake-kernel';

const at = new Date('2026-10-01T00:00:00Z');

function bot(fields: UpdateBotInput = {}): BotEntity {
  return new BotEntity(
    'bot-1',
    fields.name ?? 'New Bot',
    '',
    fields.avatarColor ?? 'mint',
    null,
    0,
    null,
    fields.provider ?? 'anthropic',
    fields.model === undefined ? null : fields.model,
    fields.effort === undefined ? null : fields.effort,
    fields.permission ?? 'auto',
    true,
    at,
    at,
    at,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

type BotsFake = Partial<Pick<BotsRepository, 'findById' | 'update'>>;

function setup(service: BotsFake) {
  const app = fakeKernel({ [TOKENS.BotsRepository]: service });
  // Fresh for the whole spec: no read on mount races the picks.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(botsKeys.detail('bot-1'), bot());
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  const { result } = renderHook(
    () => ({ bot: useSuspenseBot('bot-1').data, update: useUpdateBotOptimistically() }),
    { wrapper },
  );
  return { result };
}

describe('useUpdateBotOptimistically', () => {
  it('shows a pick on the bot before the API answers, then the bot the API answered with', async () => {
    const answer = deferred<BotEntity>();
    const { result } = setup({ findById: vi.fn(), update: vi.fn(() => answer.promise) });

    act(() => result.current.update.mutate({ id: 'bot-1', input: { model: 'claude-opus-5-5' } }));
    await waitFor(() => expect(result.current.bot.model).toBe('claude-opus-5-5'));
    expect(result.current.bot.initials).toBe('NB');
    expect(result.current.update.isPending).toBe(true);

    // The server records what it decided, which may differ from the guess.
    await act(async () => answer.resolve(bot({ model: 'claude-opus-5-5', effort: 'high' })));
    await waitFor(() => expect(result.current.bot.effort).toBe('high'));
  });

  it('puts a refused pick back, keeping a later pick still on its way', async () => {
    const answers = { model: deferred<BotEntity>(), permission: deferred<BotEntity>() };
    const update = vi.fn((_id: string, input: UpdateBotInput) =>
      'model' in input ? answers.model.promise : answers.permission.promise,
    );
    const { result } = setup({ findById: vi.fn(), update });

    act(() => result.current.update.mutate({ id: 'bot-1', input: { model: 'claude-opus-5-5' } }));
    act(() => result.current.update.mutate({ id: 'bot-1', input: { permission: 'full' } }));
    await act(async () => answers.model.reject(new Error('refused')));

    await waitFor(() => expect(result.current.bot.model).toBeNull());
    expect(result.current.bot.permission).toBe('full');
  });
});

describe('a fact about the person', () => {
  const fact = (scope: 'bot' | 'person', botId = 'bot-1') =>
    new BotMemoryFactEntity(
      'f-1',
      'Prefers squash merges.',
      'user',
      'profile',
      scope,
      botId,
      at,
      at,
    );

  function setupFacts(saved: BotMemoryFactEntity, cached: BotMemoryFactEntity) {
    const updateFact = vi.fn(async () => saved);
    const removeFact = vi.fn(async () => {});
    const app = fakeKernel({ [TOKENS.BotsRepository]: { updateFact, removeFact } });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    queryClient.setQueryData(botsKeys.memoryList('bot-1'), [cached]);
    // The sibling read the shared fact earlier.
    queryClient.setQueryData(botsKeys.memoryList('bot-2'), [cached]);
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
        </QueryClientProvider>
      );
    }
    const { result } = renderHook(
      () => ({ update: useUpdateBotFact(), remove: useDeleteBotFact() }),
      { wrapper },
    );
    const stale = (id: string) =>
      queryClient.getQueryState(botsKeys.memoryList(id))?.isInvalidated ?? false;
    return { result, stale };
  }

  it('refreshes the other bots’ memory when it moves in or out of the person’s scope', async () => {
    const { result, stale } = setupFacts(fact('bot'), fact('person'));
    await act(() =>
      result.current.update.mutateAsync({ id: 'bot-1', factId: 'f-1', scope: 'bot' }),
    );
    expect(stale('bot-2')).toBe(true);
  });

  it('refreshes them when a shared fact is forgotten, and not for the bot’s own fact', async () => {
    const shared = setupFacts(fact('person'), fact('person'));
    await act(() => shared.result.current.remove.mutateAsync({ id: 'bot-1', factId: 'f-1' }));
    expect(shared.stale('bot-2')).toBe(true);

    const own = setupFacts(fact('bot'), fact('bot'));
    await act(() =>
      own.result.current.update.mutateAsync({ id: 'bot-1', factId: 'f-1', content: 'Rebase.' }),
    );
    expect(own.stale('bot-2')).toBe(false);
  });
});
