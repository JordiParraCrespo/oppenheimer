import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectDraftOf } from '../lib/project-draft';
import { ProjectRepositoriesField } from '../sections/project-repositories-field';

/**
 * The project dialog's way to an organization's repositories: its picker ends
 * in "Manage repository access", as the session chip does, because which
 * accounts the App is installed on is decided on GitHub. Without the row the
 * dialog had no way out of a list that held only the reader's own account.
 * What the row does once pressed is the kit's (`use-open-minted.spec.ts`);
 * this is the wiring.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const mutate = vi.hoisted(() => vi.fn());
const hasApp = vi.hoisted(() => ({ current: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useInstallations: () => ({ data: [], isPending: false, error: null }),
  useInstallationRepositoriesFor: () => ({ repositories: [], isPending: false, error: null }),
  useRepositoryBranchesFor: () => ({ byRepository: new Map(), isPending: false }),
  useStartInstallation: () => ({ mutate, isPending: false, error: null, reset: vi.fn() }),
  useRefreshInstallations: () => vi.fn(),
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useDeploymentCapabilities: () => ({ data: hasApp.current, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mutate.mockClear();
});

function Field() {
  const { control } = useForm({ defaultValues: projectDraftOf(undefined) });
  return <ProjectRepositoriesField control={control} />;
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'projects.dialog.addRepository' }));
}

describe('the project dialog repositories field', () => {
  it('wires Manage repository access to the install mint', () => {
    hasApp.current = true;
    vi.spyOn(window, 'open').mockReturnValue(null);
    render(<Field />);

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'common.repositoryAccess.manage' }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('has no foot row when the deployment has no GitHub App', () => {
    hasApp.current = false;
    render(<Field />);

    openPicker();
    expect(screen.queryByRole('button', { name: 'common.repositoryAccess.manage' })).toBeNull();
  });
});
