import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaveFor } from '../lib/leave';
import { type MintAddress, useOpenMinted } from './use-open-minted';

/**
 * Mint, then leave. Both pickers' "Manage repository access" and onboarding's
 * Connect GitHub run through this, so the two navigation policies are held
 * here: a new tab opened in the click (a popup blocker eats one opened after
 * the mint's `await`) and closed again if the mint fails, or this tab with the
 * caller's say over the address.
 */

vi.mock('../lib/leave', () => ({ leaveFor: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(leaveFor).mockClear();
});

function fakeTab() {
  return { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
}

function mintThat(outcome: 'succeeds' | 'fails'): MintAddress {
  return {
    mutate: (_variables, { onSuccess, onError }) =>
      outcome === 'succeeds' ? onSuccess({ url: 'https://github.com/install?state=s' }) : onError(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  };
}

describe('useOpenMinted', () => {
  it('opens the tab before minting and points it at the minted address', () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const mint = mintThat('succeeds');
    const mutate = vi.spyOn(mint, 'mutate');

    useOpenMinted(mint, { target: 'tab' }).open();

    expect(open.mock.invocationCallOrder[0]).toBeLessThan(mutate.mock.invocationCallOrder[0] ?? 0);
    expect(tab.location.href).toBe('https://github.com/install?state=s');
  });

  it('closes the tab when the mint fails', () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    useOpenMinted(mintThat('fails'), { target: 'tab' }).open();

    expect(tab.close).toHaveBeenCalledTimes(1);
  });

  it('leaves in this tab, through the caller’s urlFor, opening none', () => {
    const open = vi.spyOn(window, 'open');

    useOpenMinted(mintThat('succeeds'), {
      target: 'self',
      urlFor: (url) => `${url}&walk=1`,
    }).open();

    expect(open).not.toHaveBeenCalled();
    expect(leaveFor).toHaveBeenCalledWith('https://github.com/install?state=s&walk=1');
  });
});
