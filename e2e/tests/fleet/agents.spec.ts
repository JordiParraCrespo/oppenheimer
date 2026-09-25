import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';

/**
 * An agent other than Claude Code, from the composer's choices to window 0.
 *
 * The catalog's argv mapping is unit-tested on both sides of the wire; what
 * only a real runner shows is that the choices survive the whole trip — the
 * API's validation and log, `session.create` on the link, the runner's
 * generated launch table, tmux — and start the agent's own binary with them.
 * Every host carries a `grok` shim beside `claude` (`e2e/fleet/grok`) that
 * prints the argv it was started with.
 */
test.describe.configure({ timeout: 180_000 });

test('a Grok session starts grok with the model, level, effort and task it was given', async () => {
  const { api } = await signedUpContext('fleetgrok');
  const installationId = await connectInstallation(api);
  const [{ id: hostId }] = await pairedHosts(api, 1, 'grok');

  const sessionId = await createSession(api, hostId, installationId, {
    agent: 'grok',
    launch: { model: 'grok-4.7', permission: 'auto', effort: 'high' },
    prompt: 'fix the picker',
  });

  const terminal = await attach(api, sessionId);
  await terminal.waitFor(
    'GROK-SHIM argv=--model grok-4.7 --permission-mode acceptEdits --reasoning-effort xhigh fix the picker',
    120_000,
  );
  await terminal.close();

  const session = await api.get(`/api/v1/sessions/${sessionId}`);
  expect(session.status()).toBe(200);
  expect(await session.json()).toMatchObject({
    agent: 'grok',
    launch: { model: 'grok-4.7', permission: 'auto', effort: 'high' },
  });

  // The runner probes for `grok` on every host, so the host reports where the
  // shim is.
  const hosts = (await (await api.get('/api/v1/hosts')).json()) as {
    id: string;
    capabilities: { tools?: { name: string; path?: string }[] } | null;
  }[];
  const tools = hosts.find((host) => host.id === hostId)?.capabilities?.tools ?? [];
  expect(tools.find((tool) => tool.name === 'grok')?.path).toMatch(/\/grok$/);
});
