import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewSessionCodexEnvironments } from '../sections/new-session-codex-environments';

/**
 * The Codex environment picker says what its list leaves out. The host's CLI
 * starts tasks only in Codex Cloud (Legacy) environments, so one made in
 * ChatGPT Settings → Codex Cloud is never listed, and a list read off the
 * account's recent tasks (`source: tasks`) is partial. A regression that
 * dropped either line brings back the report this guards: an environment that
 * exists in ChatGPT, missing here with no word why, found out only when the
 * start fails.
 */
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-hook-form', () => ({
  useWatch: () => [],
  useController: () => ({ field: { value: null, onChange: vi.fn() } }),
}));

vi.mock('../hooks/use-new-session-form', () => ({
  useNewSessionDraft: () => ({ control: {} }),
}));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

let listing: {
  data?: { environments: unknown[]; recommended: string | null; source: 'chatgpt' | 'tasks' };
  isPending: boolean;
  isError: boolean;
  error: unknown;
};
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useInstallations: () => ({ data: [] }),
  useInstallationRepositoriesFor: () => ({ repositories: [] }),
  useHostCodexEnvironments: () => listing,
}));

const ENVIRONMENT = { id: 'e_1', label: 'kallista', pinned: false, repository: false };
const LEGACY_ONLY = 'sessions.new.codexEnvironment.legacyOnly';
const PARTIAL = 'sessions.new.codexEnvironment.partial';

function open() {
  render(<NewSessionCodexEnvironments hostId="h-1" query="" onDone={() => {}} />);
}

afterEach(cleanup);

describe('NewSessionCodexEnvironments', () => {
  it('says only legacy environments are listed when the account’s whole list was read', () => {
    listing = {
      data: { environments: [ENVIRONMENT], recommended: null, source: 'chatgpt' },
      isPending: false,
      isError: false,
      error: null,
    };
    open();

    expect(screen.getByText(LEGACY_ONLY)).toBeTruthy();
    expect(screen.queryByText(PARTIAL)).toBeNull();
  });

  it('also says the list may be missing some when it came from recent tasks', () => {
    listing = {
      data: { environments: [ENVIRONMENT], recommended: null, source: 'tasks' },
      isPending: false,
      isError: false,
      error: null,
    };
    open();

    expect(screen.getByText(PARTIAL)).toBeTruthy();
    expect(screen.getByText(LEGACY_ONLY)).toBeTruthy();
  });

  it('leaves the failure’s own words alone when the host could not list', () => {
    listing = { isPending: false, isError: true, error: new Error('signed out') };
    open();

    expect(screen.getByText('sessions.new.codexEnvironment.failed')).toBeTruthy();
    expect(screen.queryByText(LEGACY_ONLY)).toBeNull();
  });
});
