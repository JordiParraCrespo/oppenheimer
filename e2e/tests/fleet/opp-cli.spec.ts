import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { getSession, signedUpContext } from '../../support/auth';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';

/**
 * `opp`, the CLI an agent uses to hand work to another host (0.6,
 * `product/next-steps/0.6-mcp-cli-and-agent.md`), on real runners: an agent
 * in a session on one host runs `opp sessions run --host <other>`, and the
 * session starts on the other host through the control plane; `opp` then
 * prompts it, waits on it and closes it. The prompt goes through
 * `POST /sessions/{id}/prompt`, and the session's log says a person sent it,
 * whatever the words claim. Needs `apps/cli` built (`pnpm --filter
 * @oppenheimer/cli build`); the fleet's `claude` is a shim that hands its pane
 * to a shell, which is what makes the first host's agent able to run it.
 */
test.describe.configure({ timeout: 240_000 });

const OPP = resolve(fileURLToPath(import.meta.url), '../../../../apps/cli/dist/bin/opp.js');

interface SessionRow {
  id: string;
  hostId: string;
  state: string;
  lifecycle: string;
}

test('an agent on one host starts, prompts, waits on and closes a session on another with opp', async () => {
  test.skip(!existsSync(OPP), `opp is not built at ${OPP}`);

  const { api } = await signedUpContext('fleetopp');
  const installationId = await connectInstallation(api);
  const [here, there] = await pairedHosts(api, 2, 'opp');

  // Pinned to the workspace, as `opp login` mints it: a token acts inside an
  // organization only when it names exactly one.
  const { session } = (await (await getSession(api)).json()) as {
    session: { activeOrganizationId: string };
  };
  const minted = await api.post('/api/v1/tokens', {
    data: {
      name: 'opp on the first host',
      scopes: ['hosts:read', 'projects:read', 'repositories:read', 'sessions:write'],
      organizationIds: [session.activeOrganizationId],
    },
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const { token } = (await minted.json()) as { token: string };
  const env = { OPPENHEIMER_API_URL: API_URL, OPPENHEIMER_API_TOKEN: token };
  const opp = (...args: string[]) =>
    execFileSync(process.execPath, [OPP, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });

  // The first host's agent runs opp in its own terminal, naming the other host
  // and the repository the way a person would: by name.
  const parentId = await createSession(api, here.id, installationId);
  const parent = await attach(api, parentId, { credit: true });
  await parent.waitFor('CLAUDE-SHIM', 120_000);
  parent.send(
    `OPPENHEIMER_API_URL=${API_URL} OPPENHEIMER_API_TOKEN=${token} ${process.execPath} ${OPP} ` +
      `sessions run --host ${there.host.name} --repo acme-labs/xrp-mobile "review the wallet"; ` +
      `echo "OPP-EXIT=$?"\r`,
  );
  // The typed line holds `OPP-EXIT=$?`; only the shell's answer has a digit there.
  await expect.poll(() => /OPP-EXIT=\d/.test(parent.screen()), { timeout: 60_000 }).toBe(true);
  expect(parent.screen(), parent.screen().slice(-2_000)).toContain('OPP-EXIT=0');
  await parent.close();

  let child: SessionRow | undefined;
  await expect
    .poll(
      async () => {
        const page = (await (await api.get(`/api/v1/sessions?hostId=${there.id}`)).json()) as {
          data: SessionRow[];
        };
        child = page.data[0];
        return child?.lifecycle;
      },
      { timeout: 120_000, intervals: [1_000, 2_000] },
    )
    .toBe('open');
  if (!child) throw new Error('no session started on the second host');
  expect(child.hostId).toBe(there.id);

  // A follow-up prompt reaches the other host's agent: its shell runs it.
  const terminal = await attach(api, child.id, { credit: true });
  opp('sessions', 'send', child.id, 'echo sent-$((6*7))');
  await terminal.waitFor('sent-42', 30_000);
  await terminal.close();

  // The log says who sent it: the person behind the token, not the words.
  const credential = (await (await api.get('/api/v1/me/credential')).json()) as { userId: string };
  const events = (await (await api.get(`/api/v1/sessions/${child.id}/events`)).json()) as {
    data: { kind: string; payload: { sender?: unknown } }[];
  };
  expect(events.data.find((event) => event.kind === 'prompt.sent')?.payload.sender).toEqual({
    kind: 'person',
    userId: credential.userId,
  });

  // An agent at its prompt is settled, so wait returns at once and exits 0.
  const waited = JSON.parse(opp('--json', 'sessions', 'wait', child.id, '--timeout', '1m')) as {
    state: string;
  }[];
  expect(waited[0].state).not.toBe('working');

  // `--json` prints the API's answer, so a script can read whether the host closed it.
  const closed = JSON.parse(
    opp('--json', 'sessions', 'close', child.id, '--yes', '--accept-unpushed'),
  ) as SessionRow;
  expect(closed.id).toBe(child.id);
  await expect
    .poll(
      async () =>
        ((await (await api.get(`/api/v1/sessions/${child?.id}`)).json()) as SessionRow).lifecycle,
      { timeout: 60_000 },
    )
    .toBe('resolved');
});
