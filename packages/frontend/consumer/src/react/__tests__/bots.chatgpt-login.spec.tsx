import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { ChatgptLoginEntity } from '../../modules/bots/bot.entity';
import { useChatgptLogin } from '../bots.chatgpt-login';
import { botsKeys } from '../bots.queries';
import { fakeKernel } from './fake-kernel';

/**
 * The ChatGPT sign-in as the dialog reads it: opening it asks for one code,
 * an approval re-reads the providers list so the row shows the sign-in, a
 * lapsed code (`BOTS_018`) reads as `expired` rather than as a failure, and a
 * fresh code is only ever asked for on `restart`.
 */
const login = (flowId: string) =>
  new ChatgptLoginEntity(
    flowId,
    'ABCD-1234',
    'https://auth.openai.com/codex/device',
    5,
    new Date(),
  );

function setup(poll: (flowId: string) => Promise<string>) {
  let minted = 0;
  const repository = {
    startChatgptLogin: vi.fn(async () => login(`flow-${++minted}`)),
    pollChatgptLogin: vi.fn(poll),
  };
  const app = fakeKernel({ [TOKENS.BotsRepository]: repository });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, repository, invalidate };
}

describe('useChatgptLogin', () => {
  it('asks for nothing while idle', () => {
    const { wrapper, repository } = setup(async () => 'pending');
    renderHook(() => useChatgptLogin({ enabled: false }), { wrapper });
    expect(repository.startChatgptLogin).not.toHaveBeenCalled();
  });

  it('shows one code, and re-reads the providers once the person approves it', async () => {
    const { wrapper, repository, invalidate } = setup(async () => 'connected');
    const { result } = renderHook(() => useChatgptLogin(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('connected'));
    expect(result.current.login?.userCode).toBe('ABCD-1234');
    expect(repository.startChatgptLogin).toHaveBeenCalledTimes(1);
    expect(repository.pollChatgptLogin).toHaveBeenCalledWith('flow-1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: botsKeys.providers() });
  });

  it('reads a lapsed code as expired, not as an error, and restarts with a new one', async () => {
    const { wrapper, repository } = setup(async (flowId) => {
      if (flowId === 'flow-1') throw Object.assign(new Error('expired'), { code: 'BOTS_018' });
      return 'pending';
    });
    const { result } = renderHook(() => useChatgptLogin(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('expired'));
    expect(result.current.error).toBeNull();

    act(() => result.current.restart());
    await waitFor(() => expect(result.current.login?.flowId).toBe('flow-2'));
    await waitFor(() => expect(result.current.state).toBe('pending'));
    expect(repository.startChatgptLogin).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failed poll for any other reason as an error', async () => {
    const { wrapper } = setup(async () => {
      throw Object.assign(new Error('unreachable'), { code: 'BOTS_020' });
    });
    const { result } = renderHook(() => useChatgptLogin(), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe('unreachable'));
    expect(result.current.state).toBe('pending');
  });
});
