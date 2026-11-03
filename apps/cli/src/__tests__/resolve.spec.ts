import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../lib/api-types';
import { ApiClient } from '../lib/client';
import { type CliError, ExitCode } from '../lib/errors';
import { findRepositoryInProjects, pickByNameOrId, resolveRepository } from '../lib/resolve';

/**
 * A person names a host, a project or a repository the way they think of it;
 * the API takes ids. Picking the wrong one starts an agent on the wrong
 * machine, so an ambiguous name is refused, never guessed.
 */

const HOST_A = { id: '0b5d0c7e-1111-4a5b-8c9d-000000000001', name: 'mac-studio' };
const HOST_B = { id: '0b5d0c7e-1111-4a5b-8c9d-000000000002', name: 'hetzner' };

function project(overrides: Partial<Project> & Pick<Project, 'id' | 'name'>): Project {
  return {
    slug: overrides.name,
    repositories: [],
    defaultHostId: null,
    defaultAgent: null,
    isUnassigned: false,
    ...overrides,
  };
}

const APP = {
  installationId: 'inst-1',
  githubRepoId: '1234',
  repositoryFullName: 'acme/app',
  baseBranch: 'main',
  isDefault: true,
};

describe('pickByNameOrId', () => {
  it('finds by name regardless of case, and by id', () => {
    expect(pickByNameOrId([HOST_A, HOST_B], 'Mac-Studio', 'host', 'opp hosts list')).toBe(HOST_A);
    expect(pickByNameOrId([HOST_A, HOST_B], HOST_B.id, 'host', 'opp hosts list')).toBe(HOST_B);
  });

  it('refuses a name two items share instead of picking one', () => {
    const twin = { ...HOST_B, name: 'mac-studio' };
    try {
      pickByNameOrId([HOST_A, twin], 'mac-studio', 'host', 'opp hosts list');
      expect.unreachable();
    } catch (error) {
      expect((error as CliError).exitCode).toBe(ExitCode.USAGE);
      expect((error as CliError).hint).toContain('opp hosts list');
    }
  });

  it('answers not found, with where to look, for a name nothing has', () => {
    try {
      pickByNameOrId([HOST_A], 'laptop', 'host', 'opp hosts list');
      expect.unreachable();
    } catch (error) {
      expect((error as CliError).exitCode).toBe(ExitCode.NOT_FOUND);
    }
  });
});

describe('findRepositoryInProjects', () => {
  it('prefers a named project over Unassigned, and sends GitHub’s id as a number', () => {
    const unassigned = project({
      id: 'p-0',
      name: 'Unassigned',
      isUnassigned: true,
      repositories: [APP],
    });
    const named = project({ id: 'p-1', name: 'App', repositories: [APP] });

    const found = findRepositoryInProjects([unassigned, named], 'ACME/app');

    expect(found).toEqual({
      installationId: 'inst-1',
      githubRepoId: 1234,
      baseBranch: 'main',
      fullName: 'acme/app',
      projectId: 'p-1',
    });
  });

  it('answers null when no project holds the repository', () => {
    expect(findRepositoryInProjects([project({ id: 'p-1', name: 'App' })], 'acme/app')).toBeNull();
  });
});

describe('resolveRepository', () => {
  const respond = (routes: Record<string, unknown>) =>
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace('/api/v1', '');
      if (!(path in routes)) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify(routes[path]), { status: 200 });
    });

  it('falls back to the installations when no project holds it, asking the owner’s first', async () => {
    const fetchImpl = respond({
      '/projects': [],
      '/installations': [
        { id: 'inst-other', accountLogin: 'someone' },
        { id: 'inst-acme', accountLogin: 'acme' },
      ],
      '/installations/inst-acme/repositories': [
        { githubRepoId: 99, fullName: 'acme/api', defaultBranch: 'trunk' },
      ],
    });
    const client = new ApiClient({ apiUrl: 'https://api.example.com', token: 't', fetchImpl });

    const found = await resolveRepository(client, 'acme/api');

    expect(found).toEqual({
      installationId: 'inst-acme',
      githubRepoId: 99,
      baseBranch: 'trunk',
      fullName: 'acme/api',
    });
    const asked = fetchImpl.mock.calls.map(([url]) => new URL(url).pathname);
    expect(asked).not.toContain('/api/v1/installations/inst-other/repositories');
  });

  it('refuses something that is not owner/name before asking the API', async () => {
    const fetchImpl = respond({});
    const client = new ApiClient({ apiUrl: 'https://api.example.com', token: 't', fetchImpl });

    await expect(resolveRepository(client, 'just-a-name')).rejects.toMatchObject({
      exitCode: ExitCode.USAGE,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
