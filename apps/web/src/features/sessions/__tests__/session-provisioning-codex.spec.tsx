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
    i18n: { exists: () => false, t: (key: string) => key },
  }),
}));

// The shell's frame reads the router; the pane's content is what is under test.
vi.mock('@oppenheimer/frontend-web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@oppenheimer/frontend-web')>()),
  PageFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let failure: { code: string | null; detail: string | null };
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useHosts: () => ({ data: 'mac-studio' }),
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
  it('explains an environment the CLI cannot reach and links to Codex Cloud settings', () => {
    failure = { code: 'SESS_010', detail: 'codex cloud exec found no environment labelled …' };
    render(<SessionProvisioning session={SESSION} />);

    expect(screen.getByText(/sessions\.provisioning\.codexEnvironment\.body/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'sessions.provisioning.codexEnvironment.link' });
    expect(link.getAttribute('href')).toBe('https://chatgpt.com/settings/codex-cloud');
    // The host's own words stay, as the secondary line.
    expect(screen.getByText(/found no environment labelled/)).toBeTruthy();
  });

  it('says nothing about environments for any other refusal', () => {
    failure = { code: 'SESS_009', detail: "Not signed in. Please run 'codex login'" };
    render(<SessionProvisioning session={SESSION} />);

    expect(screen.queryByText(/codexEnvironment/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
