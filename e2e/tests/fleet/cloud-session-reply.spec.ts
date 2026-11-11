import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';

/**
 * A reply that wakes an idle Claude Code cloud session
 * (`product/next-steps/cloud-agents.md`, "Waking an idle session"), on a real
 * runner whose `claude` answers `-p … --cloud <id>` as the real one does
 * (`e2e/fleet/claude`): a reply no Stop hook takes is sent from the host signed
 * in to the session's claude.ai account, once, and the chat says it went that
 * way; one the host's Claude Code refuses goes back to waiting for the hook.
 * The claim's race with the hook is `session-cloud-chat.integration.spec.ts`.
 */
test.describe.configure({ timeout: 240_000 });

const PREAMBLE = 'The person following this session in Oppenheimer replied:';

interface SessionDetail {
  organizationId: string;
  cloudSessionId: string | null;
}

interface Reply {
  id: string;
  text: string;
  collectedAt: string | null;
  deliveredVia: 'hook' | 'host' | null;
}

test('a reply no Stop hook takes wakes the session from the host on its account, once', async () => {
  const { api } = await signedUpContext('fleetwake');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'wake');

  // Signed in to claude.ai, as `claude auth login` leaves the host: the
  // runner reads the account off ~/.claude.json and reports it on its heartbeat.
  box.host.exec(`printf '{"oauthAccount":{"emailAddress":"ana@example.com"}}' > ~/.claude.json`);
  await expect
    .poll(
      async () =>
        (
          (await (await api.get(`/api/v1/hosts/${box.id}`)).json()) as {
            claudeAccount: string | null;
          }
        ).claudeAccount,
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe('ana@example.com');

  const sessionId = await createSession(api, box.id, installationId, {
    prompt: 'Fix the wallet list empty state',
    cloud: true,
  });
  await waitForLifecycle(api, sessionId, 'open', 60_000);
  const session = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionDetail;
  expect(session.cloudSessionId).toMatch(/^session_01e2e[0-9]+$/);

  const replies = async () =>
    (
      (await (await api.get(`/api/v1/sessions/${sessionId}/cloud-chat`)).json()) as {
        replies: Reply[];
      }
    ).replies;
  const sends = () =>
    box.host.exec('cat ~/claude-cloud-replies.log 2>/dev/null || true').split('\n').filter(Boolean);

  // No hook is waiting: the session is idle. The wake comes 15 s later.
  const sent = await api.post(`/api/v1/sessions/${sessionId}/cloud-replies`, {
    data: { text: 'Now tag the release' },
  });
  expect(sent.status(), await sent.text()).toBe(201);
  await expect
    .poll(async () => (await replies())[0]?.deliveredVia, { timeout: 60_000, intervals: [2_000] })
    .toBe('host');
  // Breaks if the wake sends from the wrong session, without the hook's
  // preamble, or more than once (a retried job, a second wake).
  expect(sends()).toEqual([`${session.cloudSessionId}\t${PREAMBLE}\\n\\nNow tag the release\\n`]);

  // A Stop hook asking now finds nothing: the reply has gone once already.
  const minted = await api.post('/api/v1/tokens', {
    data: {
      name: 'Cloud chat',
      scopes: ['cloud-chat:write'],
      organizationIds: [session.organizationId],
    },
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const { token } = (await minted.json()) as { token: string };
  const take = await api.post('/api/v1/sessions/cloud-replies/take', {
    headers: { Authorization: `Bearer ${token}` },
    data: { cloudSessionId: session.cloudSessionId, wait: 0 },
  });
  expect(take.status(), await take.text()).toBe(200);
  expect(await take.json()).toEqual({ text: null });

  // A send the host's Claude Code refuses is handed back to the hook.
  box.host.exec('touch ~/claude-cloud-refuse');
  await api.post(`/api/v1/sessions/${sessionId}/cloud-replies`, {
    data: { text: 'And write the notes' },
  });
  await new Promise((resolve) => setTimeout(resolve, 25_000));
  const [, refused] = await replies();
  expect(refused).toMatchObject({
    text: 'And write the notes',
    collectedAt: null,
    deliveredVia: null,
  });
  expect(sends()).toHaveLength(1);
  const taken = await api.post('/api/v1/sessions/cloud-replies/take', {
    headers: { Authorization: `Bearer ${token}` },
    data: { cloudSessionId: session.cloudSessionId, wait: 0 },
  });
  expect(await taken.json()).toEqual({ text: 'And write the notes' });
});
