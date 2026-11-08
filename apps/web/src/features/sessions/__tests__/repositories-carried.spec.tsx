import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type NewSessionDraftForm, NewSessionFormContext } from '../hooks/use-new-session-form';
import { initialDraft } from '../lib/new-session-draft';
import { repositoryKey } from '../lib/session-options';
import { NewSessionRepositories } from '../sections/new-session-repositories';

/**
 * New session opens on the last session's repository. A pick there means
 * "this one instead", so the carried repository leaves; picks after it add
 * up. The regression is a second session that also clones the first one's
 * repository, or a repository picked this visit dropped as if carried after
 * the chip unmounts (the place switched to a folder and back).
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const NAMES = ['alpha', 'beta', 'gamma'];
const key = (name: string) =>
  repositoryKey({ installationId: 'inst', githubRepoId: NAMES.indexOf(name) + 1 });

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useInstallations: () => ({ data: [{ id: 'inst' }], isPending: false, error: null }),
  useInstallationRepositoriesFor: () => ({
    repositories: ['alpha', 'beta', 'gamma'].map((name, i) => ({
      installationId: 'inst',
      repository: { githubRepoId: i + 1, name, fullName: `me/${name}`, defaultBranch: 'main' },
    })),
    isPending: false,
    error: null,
  }),
  useRepositoryBranchesFor: () => ({ byRepository: new Map(), isPending: false }),
  useStartInstallation: () => ({}),
  useRefreshInstallations: () => ({}),
}));

vi.mock('@oppenheimer/frontend-web', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-web')>()),
  useManageRepositoryAccess: () => ({
    onManage: vi.fn(),
    isPending: false,
    error: null,
    dismiss: vi.fn(),
  }),
}));

afterEach(cleanup);

let form: NewSessionDraftForm;

function Draft({ chip }: { chip: boolean }) {
  form = useForm({
    defaultValues: { ...initialDraft(), scope: [{ id: key('gamma'), branch: 'main' }] },
  });
  return (
    <NewSessionFormContext.Provider value={form}>
      {chip ? <NewSessionRepositories /> : null}
    </NewSessionFormContext.Provider>
  );
}

function pick(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'sessions.new.repository.label' }));
  fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
}

const picked = () =>
  form.getValues('scope').map((scope) => NAMES[Number(scope.id.split(':').pop()) - 1]);

describe('a repository picked over the carried one', () => {
  it('replaces it, and later picks add up', () => {
    render(<Draft chip />);
    pick('alpha');
    expect(picked()).toEqual(['alpha']);
    pick('beta');
    expect(picked()).toEqual(['alpha', 'beta']);
  });

  it('keeps what this visit picked when the chip unmounts and comes back', () => {
    const { rerender } = render(<Draft chip />);
    pick('alpha');
    rerender(<Draft chip={false} />);
    rerender(<Draft chip />);
    pick('beta');
    expect(picked()).toEqual(['alpha', 'beta']);
  });
});
