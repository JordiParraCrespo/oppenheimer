import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectEditorDialog } from '../dialogs/project-editor';

/**
 * The project dialog's render budget on its busiest clock: typing the name.
 * The name is watched by Save alone, so a keystroke renders the field and the
 * button, and none of the pickers below — the repositories, the hosts, the
 * agents, the cloned-by-default list — that used to redraw on every character
 * under a dialog-wide `useWatch`.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const renders = vi.hoisted(() => new Map<string, number>());
const count = (name: string) => renders.set(name, (renders.get(name) ?? 0) + 1);

vi.mock('@oppenheimer/design-system-web', async (original) => {
  const actual = await original<typeof import('@oppenheimer/design-system-web')>();
  return {
    ...actual,
    RepositoryAddField: () => {
      count('repositories');
      return null;
    },
    RepositoryRowList: () => {
      count('cloned');
      return null;
    },
    Chip: ({ children }: { children: unknown }) => {
      count('chip');
      return <span>{String(children)}</span>;
    },
    Button: ({
      children,
      type,
      disabled,
    }: {
      children: string;
      type?: string;
      disabled?: boolean;
    }) => {
      if (type === 'submit') count('save');
      return (
        <button type={type === 'submit' ? 'submit' : 'button'} disabled={disabled}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useCreateProject: () => ({ mutate: vi.fn(), isPending: false, submittedAt: 0, error: null }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false, submittedAt: 0, error: null }),
  useInstallations: () => ({ data: [], isPending: false, error: null }),
  useInstallationRepositoriesFor: () => ({ repositories: [], isPending: false, error: null }),
  useRepositoryBranchesFor: () => ({ byRepository: new Map(), isPending: false }),
  useHosts: () => ({ data: [{ id: 'host-1', name: 'mac-studio' }], isPending: false }),
  useSessions: () => ({ data: 0 }),
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

function rendered(): Record<string, number> {
  const out = Object.fromEntries(renders);
  renders.clear();
  return out;
}

beforeEach(() => {
  render(<ProjectEditorDialog project={undefined} onClose={vi.fn()} onSaved={vi.fn()} />);
  // The Defaults fold is open, so its pickers are mounted and would count.
  fireEvent.click(screen.getByText('projects.dialog.defaults'));
  rendered();
});

afterEach(cleanup);

describe('ProjectEditorDialog', () => {
  it('renders Save and none of the pickers on a keystroke in the name', () => {
    // The pickers are on screen, so staying quiet is a result.
    expect(screen.getByText('mac-studio')).toBeTruthy();
    const name = screen.getByPlaceholderText('projects.dialog.namePlaceholder');
    fireEvent.input(name, { target: { value: 'W' } });
    fireEvent.input(name, { target: { value: 'We' } });
    fireEvent.input(name, { target: { value: 'Web' } });
    const after = rendered();
    expect(after.save).toBeGreaterThan(0);
    expect(after.repositories).toBeUndefined();
    expect(after.cloned).toBeUndefined();
    expect(after.chip).toBeUndefined();
  });
});
