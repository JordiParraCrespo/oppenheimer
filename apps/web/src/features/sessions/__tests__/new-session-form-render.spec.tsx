import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleDialogProvider } from '@/lib/console';
import { NewSessionForm } from '../sections/new-session-form';

/**
 * New session's render budget across its three clocks: a pick renders the
 * chip picked, a list settle the chip drawing it, a keystroke neither. It
 * guards against a draft in section state, where an effort pick re-rendered
 * the host chip, the repository picker and the branch pane.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // The kit's i18n concern registers itself on import.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));

const renders = vi.hoisted(() => new Map<string, number>());
const prepared = vi.hoisted(() => vi.fn());

vi.mock('../components/project-select', () => ({
  ProjectSelect: chip('project', 'project-1'),
}));
vi.mock('../components/host-select', () => ({ HostSelect: chip('host', 'host-2') }));
vi.mock('../components/repository-branch-select', () => ({
  RepositoryBranchSelect: chip('repositories', [{ id: 'installation-1:42', branch: 'main' }], {
    // A row whose key no longer parses: `toCheckouts` drops it from the body.
    stale: [{ id: 'installation-1:gone', branch: 'main' }],
  }),
}));
vi.mock('../components/branch-select', () => ({ BranchSelect: chip('branch', 'develop') }));
vi.mock('../components/permission-select', () => ({
  PermissionSelect: chip('permission', 'auto'),
}));
vi.mock('../components/agent-select', () => ({
  AgentSelect: chip('agent', { agent: 'codex', model: null }),
}));
vi.mock('../components/effort-select', () => ({ EffortSelect: chip('effort', 'high') }));

/**
 * The reads, from a store the test can settle. `useSyncExternalStore` is what
 * TanStack Query's own observers use, so a settle here re-renders exactly the
 * components that called the hook, as a real one would.
 */
const reads = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = { hosts: [] as { id: string }[], projects: [] as unknown[] };
  return {
    get: () => state,
    set(next: typeof state) {
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  // Each hook subscribes to its own slice, as a query observer subscribes to
  // its own key: settling the hosts must not look like a change to the projects.
  useProjects: (options?: { select?: (projects: unknown[]) => unknown }) => {
    const data = useSyncExternalStore(reads.subscribe, () =>
      options?.select ? options.select(reads.get().projects) : reads.get().projects,
    );
    return { data, isPending: false };
  },
  useProjectsSnapshot: () => () => reads.get().projects,
  // Applies `select` inside the subscription, as a query observer does, so a
  // reader that selects a boolean re-renders only when the boolean flips.
  useHosts: (options?: { select?: (hosts: { id: string }[]) => unknown }) => {
    const data = useSyncExternalStore(reads.subscribe, () =>
      options?.select ? options.select(reads.get().hosts) : reads.get().hosts,
    );
    return { data, isPending: false };
  },
  useHostsSnapshot: () => () => reads.get().hosts,
  useInstallations: () => ({ data: [], isPending: false }),
  useInstallationRepositoriesFor: () => ({ repositories: [], isPending: false }),
  useRepositoryBranchesFor: () => ({ byRepository: new Map(), isPending: false }),
  useManageGithubAccess: () => ({ manage: vi.fn(), error: null, dismiss: vi.fn() }),
  usePrepareSession: () => ({ mutate: prepared }),
  // Called once per render of NewSessionSend, so it doubles as that section's count.
  useCreateSession: () => {
    renders.set('send', (renders.get('send') ?? 0) + 1);
    return {
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      submittedAt: 0,
    };
  },
  useUploadSessionAttachment: () => ({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
    submittedAt: 0,
  }),
}));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useDeploymentCapabilities: () => ({ data: null, isPending: false }),
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
  lastFailure: () => ({ error: null, index: -1, dismiss: vi.fn() }),
}));

const PROJECTS = [
  {
    id: 'project-1',
    name: 'Wallet',
    defaultHostId: null,
    defaultAgent: null,
    defaultRepositories: [],
    repositories: [],
  },
];

/**
 * A chip stub: counts its renders and picks `pick` when pressed. Each of
 * `others` is one more button, named `<name>:<key>`, that picks its value.
 */
function chip(name: string, pick: unknown, others: Record<string, unknown> = {}) {
  return function Chip({ onValueChange }: { onValueChange: (value: unknown) => void }) {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return (
      <>
        <button type="button" onClick={() => onValueChange(pick)}>
          {name}
        </button>
        {Object.entries(others).map(([key, value]) => (
          <button key={key} type="button" onClick={() => onValueChange(value)}>
            {`${name}:${key}`}
          </button>
        ))}
      </>
    );
  };
}

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  window.localStorage.clear();
  reads.set({ hosts: [], projects: PROJECTS });
  // The console's dialog owner sits above the composer in the app; here it
  // holds nothing, so the chips can ask for a dialog and none opens.
  render(
    <ConsoleDialogProvider>
      <NewSessionForm />
    </ConsoleDialogProvider>,
  );
  rendered();
});

afterEach(cleanup);

describe('NewSessionForm', () => {
  it('renders only the effort chip when an effort is picked', () => {
    fireEvent.click(screen.getByRole('button', { name: 'effort' }));
    expect(rendered()).toEqual(['effort']);
  });

  it('renders only the permission chip when a level is picked', () => {
    fireEvent.click(screen.getByRole('button', { name: 'permission' }));
    expect(rendered()).toEqual(['permission']);
  });

  it('renders only the host chip and the send gate when a host is picked', () => {
    fireEvent.click(screen.getByRole('button', { name: 'host' }));
    expect(rendered()).toEqual(['host', 'send']);
  });

  /**
   * The branch chip reads the same field, and appears for a lone repository;
   * the send gate opens, since a session needs a repository.
   */
  it('renders the repository and branch chips and the send gate when a repository is picked', () => {
    fireEvent.click(screen.getByRole('button', { name: 'repositories' }));
    expect(rendered()).toEqual(['branch', 'repositories', 'send']);
  });

  /**
   * The host is asked to get the repository ready as soon as the draft names
   * both, and once: a second pick of the same ones asks nothing more.
   */
  it('asks the host to prepare the repository once a host and a repository are picked', () => {
    prepared.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'host' }));
    expect(prepared).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'repositories' }));
    fireEvent.click(screen.getByRole('button', { name: 'repositories' }));
    expect(prepared).toHaveBeenCalledTimes(1);
    expect(prepared).toHaveBeenCalledWith({
      hostId: 'host-2',
      checkouts: [{ installationId: 'installation-1', githubRepoId: 42, baseBranch: 'main' }],
    });
  });

  /** An agent switch decides which foot controls exist, so those three redraw. */
  it('renders the engine and the agent-dependent controls when the agent changes', () => {
    fireEvent.click(screen.getByRole('button', { name: 'agent' }));
    expect(rendered()).toEqual(['agent', 'effort', 'permission']);
  });

  /** The project chip reads the hosts for its prefill at pick time, not by subscribing. */
  it('renders only the host chip when the host list settles', () => {
    act(() => reads.set({ ...reads.get(), hosts: [{ id: 'host-1' }] }));
    expect(rendered()).toEqual(['host']);
  });

  /** The send reads the projects when it sends, so a refetch never reaches the composer. */
  it('renders only the project chip when the project list settles', () => {
    act(() => reads.set({ ...reads.get(), projects: [...PROJECTS] }));
    expect(rendered()).toEqual(['project']);
  });

  it('renders no chip while the task is being typed', () => {
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'F' } });
    fireEvent.change(textarea, { target: { value: 'Fix' } });
    expect(rendered()).toEqual([]);
  });

  it('summarises the picked project under the title', () => {
    cleanup();
    render(
      <ConsoleDialogProvider>
        <NewSessionForm heading={<h1>title</h1>} />
      </ConsoleDialogProvider>,
    );
    expect(screen.getByText('sessions.new.subtitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'project' }));
    expect(screen.getByText('sessions.new.subtitleProject')).toBeTruthy();
  });

  /** The send gate (05): a host still in the workspace and one repository the body can carry. */
  describe('the send gate', () => {
    function composer() {
      return {
        field: screen.getByRole<HTMLTextAreaElement>('textbox'),
        send: screen.getByRole<HTMLButtonElement>('button', { name: 'sessions.new.composer.send' }),
      };
    }

    beforeEach(() => {
      act(() => reads.set({ ...reads.get(), hosts: [{ id: 'host-2' }] }));
      fireEvent.click(screen.getByRole('button', { name: 'host' }));
      fireEvent.change(composer().field, { target: { value: 'Fix the build' } });
    });

    it('holds the field and the send button until a repository is picked', () => {
      expect(composer().field.disabled).toBe(true);
      expect(composer().send.disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'repositories' }));
      expect(composer().field.disabled).toBe(false);
      expect(composer().send.disabled).toBe(false);
    });

    it('stays shut for a pick the request would drop', () => {
      fireEvent.click(screen.getByRole('button', { name: 'repositories:stale' }));
      expect(composer().field.disabled).toBe(true);
      expect(composer().send.disabled).toBe(true);
    });
  });

  it('remembers a pick for the next visit, but never the permission level', () => {
    fireEvent.click(screen.getByRole('button', { name: 'effort' }));
    fireEvent.click(screen.getByRole('button', { name: 'permission' }));

    const stored = JSON.parse(window.localStorage.getItem('oppenheimer.new-session.draft') ?? '{}');
    expect(stored.efforts).toEqual({ 'claude-code': 'high' });
    expect(stored).not.toHaveProperty('permission');
  });
});
