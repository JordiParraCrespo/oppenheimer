import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';

/**
 * A session's changes, read off its host by the API on a real runner: a
 * commit on the session's branch, an edit not committed yet and an untracked
 * file in its worktree, through `GET /sessions/{id}/changes` and the link's
 * `session.changes.read`. Since the branch left its base, all three show;
 * with `uncommitted`, only the edit and the untracked file.
 */
test.describe.configure({ timeout: 180_000 });

interface ChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

interface Changes {
  state: string;
  scope: string;
  checkouts: { files: ChangedFile[]; base: string | null; additions: number }[];
}

test('the API reads what a session changed off its host, since its base or not committed yet', async () => {
  const { api } = await signedUpContext('fleetchanges');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'changes');
  const sessionId = await createSession(api, box.id, installationId);
  await waitForLifecycle(api, sessionId, 'open');

  // The session's checkout is the one worktree in the host's sessions: its `.git` is a file.
  const worktrees = () =>
    box.host
      .exec(`find "$HOME" -name .git -type f -path '*/sessions*/*' 2>/dev/null || true`)
      .split('\n')
      .filter(Boolean);
  await expect
    .poll(worktrees, { message: 'the session’s worktree', timeout: 30_000 })
    .toHaveLength(1);
  const worktree = worktrees()[0].replace(/\/\.git$/, '');
  box.host.exec(
    [
      `cd '${worktree}'`,
      "printf 'one\\ntwo\\n' > committed.txt",
      'git add committed.txt',
      "git -c user.email=e2e@example.com -c user.name=E2E commit -q -m 'session work'",
      "printf 'three\\n' >> committed.txt",
      "printf 'loose\\n' > 'loose file.txt'",
    ].join(' && '),
  );

  const read = async (scope?: string) => {
    const response = await api.get(
      `/api/v1/sessions/${sessionId}/changes${scope ? `?scope=${scope}` : ''}`,
    );
    expect(response.status()).toBe(200);
    return (await response.json()) as Changes;
  };
  const byPath = (changes: Changes) =>
    Object.fromEntries(changes.checkouts[0].files.map((file) => [file.path, file]));

  const sinceBase = await read();
  expect(sinceBase.state).toBe('listed');
  expect(sinceBase.scope).toBe('base');
  expect(sinceBase.checkouts).toHaveLength(1);
  expect(sinceBase.checkouts[0].base).toMatch(/^[0-9a-f]{40}$/);
  const all = byPath(sinceBase);
  expect(Object.keys(all).sort()).toEqual(['committed.txt', 'loose file.txt']);
  expect(all['committed.txt']).toMatchObject({ status: 'added', additions: 3, deletions: 0 });
  expect(all['committed.txt'].patch).toContain('+three\n');
  expect(all['loose file.txt']).toMatchObject({ status: 'untracked', additions: 1 });
  expect(all['loose file.txt'].patch).toContain('+loose\n');

  const uncommitted = await read('uncommitted');
  const loose = byPath(uncommitted);
  expect(Object.keys(loose).sort()).toEqual(['committed.txt', 'loose file.txt']);
  expect(loose['committed.txt']).toMatchObject({ status: 'modified', additions: 1, deletions: 0 });

  const missing = await api.get('/api/v1/sessions/7d3e5a10-0000-4000-8000-000000000000/changes', {
    failOnStatusCode: false,
  });
  expect(missing.status()).toBe(404);
});
