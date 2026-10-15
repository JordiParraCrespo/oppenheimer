import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';

/**
 * Where a session runs, checked on the machine
 * (`product/versions/mvp/24-session-places.md`): a worktree session lands in
 * the work folder under its account, workspace and slug, carries the marker
 * that licenses its removal, and is removed on close; a folder session runs in
 * a folder the person already has, writes nothing into it and leaves it there
 * when it closes; the folder picker reads the host's directories through its
 * runner.
 */
test.describe.configure({ timeout: 240_000 });

interface FolderListing {
  path: string;
  parent: string | null;
  home: string;
  branch: string | null;
  entries: { name: string; path: string; branch: string | null }[];
  truncated: boolean;
  recent: { path: string; lastUsedAt: string }[];
}

interface SessionDetail {
  id: string;
  slug: string;
  organizationId: string;
  place: 'worktree' | 'folder';
  folderPath: string | null;
  checkouts: { directoryName: string }[];
}

test('a worktree session lives in the work folder under its ids, and leaves with its marker', async () => {
  const { api } = await signedUpContext('fleetplaces');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'places-wt');
  const me = (await (await api.get('/api/v1/users/me')).json()) as { id: string };

  const sessionId = await createSession(api, box.id, installationId, { agent: 'shell' });
  await waitForLifecycle(api, sessionId, 'open');
  const session = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail;
  expect(session.place).toBe('worktree');
  expect(session.folderPath).toBeNull();

  const workspace = `~/oppenheimer/${me.id}/${session.organizationId}`;
  const sessionDir = `${workspace}/sessions/${session.slug}`;
  const checkout = `${sessionDir}/${session.checkouts[0].directoryName}`;
  // The checkout is made after the pane opens: wait for it rather than race it.
  await expect
    .poll(
      () =>
        box.host.exec(`test -d ${checkout}/.git || test -f ${checkout}/.git && echo yes || true`),
      {
        timeout: 60_000,
      },
    )
    .toContain('yes');

  expect(JSON.parse(box.host.exec('cat ~/oppenheimer/layout.json'))).toEqual({ version: 2 });
  const marker = JSON.parse(box.host.exec(`cat ${sessionDir}/.oppenheimer/meta.json`)) as {
    kind: string;
    id: string;
  };
  expect(marker).toMatchObject({ kind: 'session', id: sessionId });
  // The store is bare and beside the sessions, never a checkout of its own.
  expect(
    box.host.exec(`git -C ${workspace}/repos/*--xrp-mobile.git rev-parse --is-bare-repository`),
  ).toBe('true');
  expect(
    box.host.exec(`git -C ${workspace}/repos/*--xrp-mobile.git config oppenheimer.repo-id`),
  ).toBe('821374923');

  // The agent's working directory is the checkout.
  const terminal = await attach(api, sessionId, { credit: true });
  terminal.send('pwd\n');
  await terminal.waitFor(`sessions/${session.slug}/${session.checkouts[0].directoryName}`, 30_000);
  await terminal.close();

  const closed = await api.delete(`/api/v1/sessions/${sessionId}?acceptUnpushedWork=true`, {
    failOnStatusCode: false,
  });
  expect([200, 202, 204]).toContain(closed.status());
  await waitForLifecycle(api, sessionId, 'resolved', 60_000);
  expect(box.host.exec(`test -e ${sessionDir} && echo present || echo gone`)).toBe('gone');
  // The store stays: it is a cache of GitHub, kept for the next session.
  expect(box.host.exec(`ls -d ${workspace}/repos/*--xrp-mobile.git >/dev/null && echo kept`)).toBe(
    'kept',
  );
});

test('a folder session runs in a folder on the host and leaves it exactly as it was', async () => {
  const { api } = await signedUpContext('fleetfolder');
  const [box] = await pairedHosts(api, 1, 'places-folder');
  const home = box.host.exec('echo $HOME');
  const folder = `${home}/notes-${Date.now()}`;
  box.host.exec(
    `mkdir -p ${folder}/drafts && echo hello > ${folder}/README && ` +
      `git -C ${folder} init -q -b scratchpad && mkdir -p ${home}/.hidden-dir && touch ${home}/a-file`,
  );
  const before = box.host.exec(
    `cd ${folder} && find . -path ./.git -prune -o -print | sort && cat README`,
  );

  // The picker: the home directory by default, folders only, no hidden ones,
  // a repository with the branch it is on.
  const listed = await api.get(`/api/v1/hosts/${box.id}/folders`);
  expect(listed.status(), await listed.text()).toBe(200);
  const atHome = (await listed.json()) as FolderListing;
  expect(atHome.path).toBe(home);
  expect(atHome.home).toBe(home);
  const entry = atHome.entries.find((row) => row.path === folder);
  expect(entry?.branch).toBe('scratchpad');
  expect(atHome.entries.some((row) => row.name === '.hidden-dir')).toBe(false);
  expect(atHome.entries.some((row) => row.name === 'a-file')).toBe(false);

  const inside = (await (
    await api.get(`/api/v1/hosts/${box.id}/folders`, { params: { path: folder } })
  ).json()) as FolderListing;
  expect(inside).toMatchObject({ path: folder, parent: home, branch: 'scratchpad' });
  expect(inside.entries.map((row) => row.name)).toEqual(['drafts']);

  const missing = await api.get(`/api/v1/hosts/${box.id}/folders`, {
    params: { path: `${folder}/nope` },
    failOnStatusCode: false,
  });
  expect(missing.status()).toBe(404);
  expect(((await missing.json()) as { code: string }).code).toBe('SESSIONS_028');
  const notDir = await api.get(`/api/v1/hosts/${box.id}/folders`, {
    params: { path: `${folder}/README` },
    failOnStatusCode: false,
  });
  expect(notDir.status()).toBe(422);
  expect(((await notDir.json()) as { code: string }).code).toBe('SESSIONS_029');

  const created = await api.post('/api/v1/sessions', {
    headers: { 'Idempotency-Key': `e2e-folder-${Date.now()}` },
    data: { hostId: box.id, agent: 'shell', folder },
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  const sessionId = ((await created.json()) as { id: string }).id;
  const open = await waitForLifecycle(api, sessionId, 'open');
  expect(open.checkouts).toEqual([]);
  const detail = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail;
  expect(detail).toMatchObject({ place: 'folder', folderPath: folder });

  const terminal = await attach(api, sessionId, { credit: true });
  terminal.send('pwd; git branch --show-current\n');
  await terminal.waitFor(`${folder}\r\nscratchpad`, 30_000);
  await terminal.close();

  // Nothing was written into it, and nothing was made in the work folder.
  expect(box.host.exec(`test -e ${folder}/.oppenheimer && echo marked || echo clean`)).toBe(
    'clean',
  );
  expect(box.host.exec(`ls ~/oppenheimer/*/*/sessions 2>/dev/null | wc -l`)).toBe('0');

  // It is a recent folder on that host now.
  const again = (await (await api.get(`/api/v1/hosts/${box.id}/folders`)).json()) as FolderListing;
  expect(again.recent.map((row) => row.path)).toContain(folder);

  const closed = await api.delete(`/api/v1/sessions/${sessionId}`, { failOnStatusCode: false });
  expect([200, 202, 204]).toContain(closed.status());
  await waitForLifecycle(api, sessionId, 'resolved', 60_000);
  expect(
    box.host.exec(`tmux -L oppenheimer ls -F '#{session_name}' 2>/dev/null || true`),
  ).not.toContain(`opp-${sessionId}`);
  expect(
    box.host.exec(`cd ${folder} && find . -path ./.git -prune -o -print | sort && cat README`),
  ).toBe(before);
});

test('a folder that went away before the create fails the session instead of making it', async () => {
  const { api } = await signedUpContext('fleetfoldergone');
  const [box] = await pairedHosts(api, 1, 'places-gone');
  const home = box.host.exec('echo $HOME');
  const created = await api.post('/api/v1/sessions', {
    headers: { 'Idempotency-Key': `e2e-folder-gone-${Date.now()}` },
    data: { hostId: box.id, agent: 'shell', folder: `${home}/never-made` },
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  const sessionId = ((await created.json()) as { id: string }).id;
  await waitForLifecycle(api, sessionId, 'failed', 60_000);
  expect(box.host.exec(`test -e ${home}/never-made && echo made || echo absent`)).toBe('absent');
});
