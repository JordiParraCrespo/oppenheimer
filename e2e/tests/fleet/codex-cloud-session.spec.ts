import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';

/**
 * A task in Codex cloud (`product/next-steps/cloud-agents.md`), on a real
 * runner with a `codex` that answers `cloud exec` and `cloud list --json` as
 * the real one does (`e2e/fleet/codex`): the host starts the task on the
 * checkout's base branch in the environment named for the repository, with
 * nothing cloned, reports the task's id, and from then on reads its status off
 * `codex cloud list` and reports it as the session's state. No browser
 * extension is involved: unlike Claude Code's cloud, Codex's CLI answers it.
 */
test.describe.configure({ timeout: 300_000 });

interface SessionDetail {
  place: string;
  agent: string;
  lifecycle: string;
  state: string;
  cloudSessionId: string | null;
}

test('a Codex cloud task starts on the host, and the host reports where it stands', async () => {
  const { api } = await signedUpContext('fleetcodex');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'codex');

  const task = 'Fix the wallet list empty state';
  const sessionId = await createSession(api, box.id, installationId, {
    agent: 'codex',
    prompt: task,
    cloud: true,
  });
  await waitForLifecycle(api, sessionId, 'open', 60_000).catch((error: Error) => {
    throw new Error(`${error.message}\n--- host log ---\n${box.host.logs().slice(-4_000)}`);
  });
  const detail = async () =>
    (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail;

  const session = await detail();
  expect(session).toMatchObject({ place: 'cloud', agent: 'codex' });
  expect(session.cloudSessionId).toMatch(/^task_e_e2e[0-9]+$/);

  // The CLI ran once, in the repository's environment, on its base branch, with the task.
  const [started] = box.host
    .exec('cat ~/codex-cloud.log')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'));
  expect(started[0]).toBe(session.cloudSessionId);
  expect(started[1]).toMatch(/\/xrp-mobile$/);
  expect(started[3]).toBe(task);
  // Nothing was cloned or kept for it.
  expect(box.host.exec('ls ~/oppenheimer/*/*/sessions 2>/dev/null | wc -l').trim()).toBe('0');

  // Codex has it: working, the moment it started.
  await expect.poll(async () => (await detail()).state).toBe('working');

  // Codex finishes it; the host's next read says so, within its minute: done
  // is ready for a prompt, which the sidebar groups as idle.
  box.host.exec(`echo ready > ~/codex-cloud/${session.cloudSessionId}`);
  await expect
    .poll(async () => (await detail()).state, { timeout: 150_000, intervals: [5_000] })
    .toBe('idle');

  const closed = await api.delete(`/api/v1/sessions/${sessionId}?acceptUnpushedWork=true`, {
    failOnStatusCode: false,
  });
  expect([200, 202, 204]).toContain(closed.status());
  await waitForLifecycle(api, sessionId, 'resolved', 60_000);
});
