import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewSessionCodexEnvironments } from '../sections/new-session-codex-environments';

/**
 * The Codex environment picker's foot is one line: whose environments these
 * are, or, when the host could only read its recent tasks, that these are
 * those. A failed list says why in full, in the kit's alert, instead.
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

// The kit's alert resolves the failure's sentence; here it says the error's own.
vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: ({ error, fallback }: { error: unknown; fallback: string }) => (
    <div role="alert">{error instanceof Error ? error.message : fallback}</div>
  ),
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
const LIVES = 'sessions.new.codexEnvironment.lives';
const RECENT = 'sessions.new.codexEnvironment.recent';

function open() {
  render(<NewSessionCodexEnvironments hostId="h-1" query="" onDone={() => {}} />);
}

afterEach(cleanup);

describe('NewSessionCodexEnvironments', () => {
  it('says the environments are the account’s when its whole list was read', () => {
    listing = {
      data: { environments: [ENVIRONMENT], recommended: null, source: 'chatgpt' },
      isPending: false,
      isError: false,
      error: null,
    };
    open();

    expect(screen.getByText(LIVES)).toBeTruthy();
    expect(screen.queryByText(RECENT)).toBeNull();
  });

  it('says they come from recent tasks, in the same one line, when that is all the host read', () => {
    listing = {
      data: { environments: [ENVIRONMENT], recommended: null, source: 'tasks' },
      isPending: false,
      isError: false,
      error: null,
    };
    open();

    expect(screen.getByText(RECENT)).toBeTruthy();
    expect(screen.queryByText(LIVES)).toBeNull();
  });

  it('says why the host could not list on lines of its own, not in a row’s one cut line', () => {
    const refusal = 'Codex on the host isn’t signed in to ChatGPT. Run codex login on the host.';
    listing = { isPending: false, isError: true, error: new Error(refusal) };
    open();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(refusal);
    expect(screen.getByRole('option').textContent).not.toContain(refusal);
    expect(screen.queryByText(LIVES)).toBeNull();
  });
});
