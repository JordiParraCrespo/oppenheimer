/**
 * The composer's optimistic save (`useUpdateBotOptimistically`): a pick shows
 * on the bot's detail before the API answers, and a refusal puts back what
 * that pick set and nothing else. The cache helpers the other bot mutations
 * share write in place, which `query-keys.spec.ts` and the screens cover.
 */
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { BotEntity, type UpdateBotInput } from '../../modules/bots/bot.entity';
import type { BotsRepository } from '../../modules/bots/bots.repository';
import { botsKeys, useSuspenseBot, useUpdateBotOptimistically } from '../bots.queries';
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
