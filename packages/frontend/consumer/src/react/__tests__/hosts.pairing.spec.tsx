import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { HostEntity, type HostPairing, type HostPairingToken } from '../../modules/hosts';
import { useHostPairing } from '../hosts.pairing';
import { fakeKernel } from './fake-kernel';

/**
 * What Add host is allowed to conclude from what it reads.
 *
 * The flow answers one question — "has *this* token been spent, and on which
 * machine" — and the trap it was written against is answering a cheaper one
 * instead. An account that already owns a machine has a non-empty host list the
 * moment the dialog opens; a surface that watched the list would offer Use this
 * host under a command nobody had run.
 */

const PAIRING: HostPairing = {
  id: 'token-1',
  installCommand: 'curl -fsSL https://example.test/install.sh | sh -s -- --token opk_secret',
  agentPrompt: 'Install the runner here with --token opk_secret',
  installScriptSha256: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  redeemedHostId: null,
};

const OWNED = new HostEntity(
  'host-1',
  'Old box',
  true,
  'old-box',
  'linux',
  null,
  null,
  null,
  new Date(),
);
const PAIRED = new HostEntity(
  'host-2',
  'New host',
  false,
  'new-box',
  'macos',
  null,
  null,
  null,
  new Date(),
);

function setup(tokens: HostPairingToken[], hosts: HostEntity[]) {
  const service = {
    pair: vi.fn().mockResolvedValue(PAIRING),
    pairings: vi.fn().mockResolvedValue(tokens),
    findAll: vi.fn().mockResolvedValue(hosts),
  };
  const app = fakeKernel({ [TOKENS.HostsService]: service });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }

  return { wrapper, service };
}

const unredeemed: HostPairingToken = {
  id: 'token-1',
  expiresAt: PAIRING.expiresAt,
  redeemedHostId: null,
};
const redeemed: HostPairingToken = {
  id: 'token-1',
  expiresAt: PAIRING.expiresAt,
  redeemedHostId: 'host-2',
};

describe('useHostPairing', () => {
  it('shows the minted command and how long its token has left', async () => {
    const { wrapper } = setup([unredeemed], [OWNED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });

    await waitFor(() => expect(result.current.pairing).toEqual(PAIRING));
    expect(result.current.expired).toBe(false);
    // A count, not `mm:ss`: how it is said belongs to the surface.
    expect(result.current.secondsLeft).toBeGreaterThan(3500);
  });

  it('never reads a fresh token as expired, not even for the render it arrives in', async () => {
    // The count used to be set by the effect after the render that first held
    // the token, so that render said `expired` — and switched the poll off —
    // for a frame. Every render is recorded, not just the last one.
    const { wrapper } = setup([unredeemed], [OWNED]);
    const seen: { hasPairing: boolean; expired: boolean }[] = [];
    const { result } = renderHook(
      () => {
        const flow = useHostPairing('New host');
        seen.push({ hasPairing: Boolean(flow.pairing), expired: flow.expired });
        return flow;
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.pairing).toEqual(PAIRING));
    expect(seen.filter((render) => render.hasPairing && render.expired)).toEqual([]);
  });

  it('offers no host while the token is unspent, however many the account owns', async () => {
    const { wrapper } = setup([unredeemed], [OWNED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });

    await waitFor(() => expect(result.current.pairing).toEqual(PAIRING));
    expect(result.current.host).toBeNull();
  });

  it('resolves the host this token named, not the first one in the list', async () => {
    const { wrapper } = setup([redeemed], [OWNED, PAIRED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });

    await waitFor(() => expect(result.current.host?.id).toBe('host-2'));
    expect(result.current.host?.name).toBe('New host');
  });

  it('mints once per visit, and again only when asked', async () => {
    const { wrapper, service } = setup([unredeemed], [OWNED]);
    const { result, rerender } = renderHook(() => useHostPairing('New host'), { wrapper });

    await waitFor(() => expect(result.current.pairing).toEqual(PAIRING));
    rerender();
    expect(service.pair).toHaveBeenCalledTimes(1);

    result.current.regenerate();
    await waitFor(() => expect(service.pair).toHaveBeenCalledTimes(2));
  });

  it('drops the host it was offering when the reader takes a new token', async () => {
    // Use this host must not stay armed under a command that has been thrown
    // away: the new token has not been spent, so nothing is paired yet.
    const { wrapper, service } = setup([redeemed], [OWNED, PAIRED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });

    await waitFor(() => expect(result.current.host?.id).toBe('host-2'));

    service.pair.mockResolvedValue({ ...PAIRING, id: 'token-2' });
    result.current.regenerate();

    await waitFor(() => expect(result.current.pairing?.id).toBe('token-2'));
    expect(result.current.host).toBeNull();
  });

  it('asks the mint to replace the unspent token on screen', async () => {
    // A token pasted into the wrong window must stop working when its reader
    // asks for another, not an hour later — and in the same write as the mint.
    const { wrapper, service } = setup([unredeemed], [OWNED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });
    await waitFor(() => expect(result.current.pairing).toEqual(PAIRING));

    result.current.regenerate();

    await waitFor(() => expect(service.pair).toHaveBeenCalledTimes(2));
    expect(service.pair).toHaveBeenLastCalledWith('New host', 'token-1');
  });

  it('replaces nothing when the token already paired a machine', async () => {
    const { wrapper, service } = setup([redeemed], [OWNED, PAIRED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });
    await waitFor(() => expect(result.current.host?.id).toBe('host-2'));

    result.current.regenerate();

    await waitFor(() => expect(service.pair).toHaveBeenCalledTimes(2));
    expect(service.pair).toHaveBeenLastCalledWith('New host', undefined);
  });

  it('keeps the token on screen when the replacement is refused', async () => {
    const { wrapper, service } = setup([unredeemed], [OWNED]);
    const { result } = renderHook(() => useHostPairing('New host'), { wrapper });
    await waitFor(() => expect(result.current.pairing).toEqual(PAIRING));

    service.pair.mockRejectedValueOnce(new Error('HOSTS_006'));
    result.current.regenerate();

    await waitFor(() => expect(result.current.error?.message).toBe('HOSTS_006'));
    expect(result.current.pairing).toEqual(PAIRING);
  });
});
