import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectFormValues } from '../lib/project-draft';
import { ProjectRepositoriesField } from '../sections/project-repositories-field';

/**
 * The project dialog's way to an organization's repositories: its picker ends
 * in "Manage repository access", as the session chip does, because which
 * accounts the App is installed on is decided on GitHub. Without it the dialog
 * had no way out of a list that held only the reader's own account.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const manage = vi.hoisted(() => vi.fn());
const installUrl = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useInstallations: () => ({ data: [], isPending: false, error: null }),
  useInstallationRepositoriesFor: () => ({ repositories: [], isPending: false, error: null }),
  useRepositoryBranchesFor: () => ({ byRepository: new Map(), isPending: false }),
  useManageGithubAccess: () => ({ manage, error: null, dismiss: vi.fn() }),
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useDeploymentCapabilities: () => ({ data: installUrl.current, isPending: false }),
}));

afterEach(() => {
  cleanup();
  manage.mockClear();
});

function Field() {
  const { control } = useForm<ProjectFormValues>({
    defaultValues: { rows: [] } as unknown as ProjectFormValues,
  });
  return <ProjectRepositoriesField control={control} />;
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'projects.dialog.addRepository' }));
}

describe('the project dialog repositories field', () => {
  it('offers Manage repository access, which mints before it leaves for GitHub', () => {
    installUrl.current = 'https://github.com/apps/oppenheimer/installations/new';
    render(<Field />);

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'projects.dialog.manage' }));
    expect(manage).toHaveBeenCalledTimes(1);
  });

  it('has no foot row when the deployment has no GitHub App', () => {
    installUrl.current = null;
    render(<Field />);

    openPicker();
    expect(screen.queryByRole('button', { name: 'projects.dialog.manage' })).toBeNull();
  });
});
