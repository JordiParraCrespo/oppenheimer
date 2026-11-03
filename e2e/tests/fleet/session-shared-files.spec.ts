import { type APIRequestContext, expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';

/**
 * A file an agent shares (`runner sessions send-file`), on a real runner: the
 * runner tells the control plane the file's metadata as `file.shared`, so a
 * bot driving the session can see it (`product/next-steps/agent-tools.md`
 * §7), and never where it is on the host nor its bytes.
 */
test.describe.configure({ timeout: 180_000 });

interface LogEntry {
  kind: string;
  payload: Record<string, unknown>;
}

async function log(api: APIRequestContext, sessionId: string): Promise<LogEntry[]> {
  const response = await api.get(`/api/v1/sessions/${sessionId}/events?limit=100`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data: LogEntry[] }).data;
}

test("a shared file's metadata reaches the session's log, never its path", async () => {
  const { api } = await signedUpContext('fleetshared');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'shared');
  const sessionId = await createSession(api, box.id, installationId);

  await expect
    .poll(
      () => {
        try {
          return box.host.exec(
            `mkdir -p ~/shots && printf '# Notes\\n' > ~/shots/notes.md && cd ~/shots && OPPENHEIMER_SESSION=${sessionId} runner sessions send-file notes.md --caption "My notes"`,
          );
        } catch {
          return 'not yet';
        }
      },
      { timeout: 120_000, intervals: [2_000] },
    )
    .toContain('shared notes.md');

  await expect
    .poll(async () => (await log(api, sessionId)).find((entry) => entry.kind === 'file.shared'), {
      timeout: 30_000,
    })
    .toMatchObject({
      payload: { name: 'notes.md', mediaType: 'text/markdown', caption: 'My notes', hasPreview: false },
    });
  const shared = (await log(api, sessionId)).find((entry) => entry.kind === 'file.shared');
  // The host's path and the bytes stay on the host.
  expect(JSON.stringify(shared?.payload)).not.toContain('/shots');
  expect(shared?.payload).not.toHaveProperty('path');
  expect(shared?.payload).not.toHaveProperty('text');
});
