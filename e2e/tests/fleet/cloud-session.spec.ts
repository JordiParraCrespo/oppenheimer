import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { pairedHosts, waitForHost } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';

/**
 * A session in Claude Code's cloud (`product/research/cloud-agents.md` §5B),
 * on a real runner with a `claude` that answers `--cloud` as the real one
 * does (`e2e/fleet/claude`): the host fetches the repository with the
 * create's own token, runs `claude --cloud` in a checkout of it, reports the
 * cloud session's id and keeps nothing; the browser extension's status report
 * then draws the session's state, for the sessions this workspace launched only.
 */
test.describe.configure({ timeout: 240_000 });

interface SessionDetail {
  id: string;
  organizationId: string;
  place: string;
  lifecycle: string;
  state: string;
  cloudSessionId: string | null;
  checkouts: { branch: string }[];
}

test('a cloud session starts on the host, keeps nothing there, and takes its status from the extension', async () => {
  const { api } = await signedUpContext('fleetcloud');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'cloud');

  const task = 'Fix the wallet list empty state';
  const sessionId = await createSession(api, box.id, installationId, { prompt: task, cloud: true });
  await waitForLifecycle(api, sessionId, 'open', 60_000).catch((error: Error) => {
    throw new Error(`${error.message}\n--- host log ---\n${box.host.logs().slice(-4_000)}`);
  });

  const session = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail;
  expect(session.place).toBe('cloud');
  expect(session.cloudSessionId).toMatch(/^session_01e2e[0-9]+$/);

  // The CLI ran once, in a checkout of the session's repository, with the task.
  const [started] = box.host
    .exec('cat ~/claude-cloud.log')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'));
  expect(started[0]).toBe(session.cloudSessionId);
  expect(started[2]).toMatch(/^https:\/\/github\.com\/[^/]+\/xrp-mobile\.git$/);
  expect(started[3]).toBe(task);
  // The checkout it ran in is gone, and no session folder was made.
  expect(box.host.exec(`test -e '${started[1]}' && echo kept || echo gone`)).toBe('gone');
  expect(box.host.exec('ls ~/oppenheimer/*/*/sessions 2>/dev/null | wc -l').trim()).toBe('0');

  // The extension reports with a personal token, as a person connects it:
  // `sessions:write`, pinned to the workspace whose sessions it reports on.
  const minted = await api.post('/api/v1/tokens', {
    data: {
      name: 'Chrome extension',
      scopes: ['sessions:write'],
      organizationIds: [session.organizationId],
    },
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const { token } = (await minted.json()) as { token: string };
  const report = (state: string, cloudSessionId = session.cloudSessionId) =>
    api.post('/api/v1/sessions/cloud-status', {
      headers: { Authorization: `Bearer ${token}` },
      data: { sessions: [{ cloudSessionId, state }] },
    });

  const running = await report('running');
  expect(running.status(), await running.text()).toBe(200);
  expect(await running.json()).toEqual({ matched: 1 });
  await expect
    .poll(
      async () =>
        ((await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail).state,
    )
    .toBe('working');

  // Waiting on the person: reported twice, it holds for half a minute and turns.
  await report('needs-input');
  await report('needs-input');
  await expect
    .poll(
      async () =>
        ((await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail).state,
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe('waiting-on-you');

  // A cloud session this workspace did not launch is not this API's to know.
  expect(await (await report('running', 'session_01SomebodyElse000')).json()).toEqual({
    matched: 0,
  });

  // A hello from the host does not take a cloud session for a lost pane: the
  // host never held it. The supervisor restarts the runner, which says hello.
  const before = box.host.logs().length;
  box.host.killRunner();
  await expect
    .poll(() => box.host.logs().slice(before).includes('restarting'), { timeout: 15_000 })
    .toBe(true);
  await waitForHost(api, box.host, true);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const after = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail & {
    stoppedAt: string | null;
  };
  expect(after).toMatchObject({ lifecycle: 'open', stoppedAt: null });

  const closed = await api.delete(`/api/v1/sessions/${sessionId}?acceptUnpushedWork=true`, {
    failOnStatusCode: false,
  });
  expect([200, 202, 204]).toContain(closed.status());
  await waitForLifecycle(api, sessionId, 'resolved', 60_000);
});
