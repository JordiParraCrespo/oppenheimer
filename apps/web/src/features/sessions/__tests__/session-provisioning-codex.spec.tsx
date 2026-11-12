import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvisioning } from '../sections/session-provisioning';

/**
 * A Codex cloud start that found no environment the CLI can reach (`SESS_010`)
 * says why in the reader's language, with ChatGPT's Codex Cloud settings a
 * link away, instead of leaving the CLI's "not found" as the only words on
 * the page. A regression that keyed the note off anything but that code would
 * either drop it, and leave the person guessing, or show it under every
 * failed start.
 */
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.detail ? `${key}:${values.detail}` : key,
    // Only SESS_010 has help words, as in the catalog.
    i18n: {
      exists: (key: string) => key.startsWith('errors.startFailure.help.SESS_010'),
      t: (key: string) => key,
    },
  }),
}));

// The shell's frame reads the router; the pane's content is what is under test.
vi.mock('@oppenheimer/frontend-web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@oppenheimer/frontend-web')>()),
  PageFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let failure: { code: string | null; detail: string | null };
const retry = vi.fn();
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useHosts: () => ({ data: 'mac-studio' }),
  useRetrySession: () => ({ mutate: retry, isPending: false, error: null }),
  useSessionStartProgress: () => ({
    data: { steps: [], downloading: false, failure, settled: true },
    error: null,
  }),
}));

const SESSION = {
  id: 's-1',
  hostId: 'h-1',
  lifecycle: 'failed',
  agent: 'codex',
  slug: 'oppenheimer',
  scopeLabel: 'acme-labs/oppenheimer',
  isHostOffline: false,
  isFolder: false,
  folderPath: null,
  cwdCheckout: null,
  createdAt: new Date(),
} as unknown as SessionEntity;

afterEach(cleanup);

describe('SessionProvisioning after a failed Codex cloud start', () => {
  it('explains an environment not on the account and links to Codex Cloud settings', () => {
    failure = {
      code: 'SESS_010',
      detail:
        'Codex has no environment asenvcfg_gone that this ChatGPT account can start a task in: environment config not found',
    };
    render(<SessionProvisioning session={SESSION} />);

    expect(screen.getByText(/errors\.startFailure\.help\.SESS_010\.body/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'errors.startFailure.help.SESS_010.link' });
    expect(link.getAttribute('href')).toBe('https://chatgpt.com/settings/codex-cloud');
    // The host's own words stay, as the secondary line.
    expect(screen.getByText(/environment config not found/)).toBeTruthy();
  });

  it('offers Try again, which sends the same start for this session', () => {
    failure = { code: 'SESS_019', detail: 'Cloud sessions need a claude.ai sign-in.' };
    render(<SessionProvisioning session={SESSION} />);

    screen.getByRole('button', { name: 'sessions.provisioning.retry' }).click();
    expect(retry).toHaveBeenCalledWith('s-1');
  });

  it('says nothing about environments for any other refusal', () => {
    failure = { code: 'SESS_009', detail: "Not signed in. Please run 'codex login'" };
    render(<SessionProvisioning session={SESSION} />);

    expect(screen.queryByText(/startFailure\.help/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
