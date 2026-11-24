import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { turnOnForEveryone } from '../../support/flags';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A Qwen Code session on a real runner, from its launch to the Chat tab and
 * back from a restart. What only a real runner shows is the whole trip: the
 * session starts `qwen` with its task inside `--prompt-interactive=` (one
 * word, so a task starting with `-` stays a task), the runner finds the
 * conversation Qwen keeps under `~/.qwen/projects/<folder>/chats/<session
 * id>.jsonl`, the console draws its records as the chat, then each record
 * written after it opened, and a restart reopens it by id. Every
 * host carries a `qwen` shim (`e2e/fleet/qwen`) that writes the first record
 * as Qwen does; the rest is written here. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({
  baseURL: WEB_URL,
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
});

/** Appends records to the host's Qwen conversation `conversation`, as Qwen would. */
function appendQwen(
  host: { exec: (commandLine: string) => string },
  conversation: string,
  records: object[],
): void {
  const script = `
import glob, json, os, sys, time, uuid
home = os.environ.get("QWEN_HOME") or os.path.join(os.path.expanduser("~"), ".qwen")
[path] = glob.glob(os.path.join(home, "projects", "*", "chats", sys.argv[1] + ".jsonl"))
with open(path, "a") as out:
    for record in json.loads(sys.argv[2]):
        record.setdefault("uuid", str(uuid.uuid4()))
        record.setdefault("timestamp", time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()))
        out.write(json.dumps(record) + "\\n")
`;
  const encoded = Buffer.from(script).toString('base64');
  const payload = Buffer.from(JSON.stringify(records)).toString('base64');
  host.exec(
    `python3 -c "$(echo ${encoded} | base64 -d)" ${conversation} "$(echo ${payload} | base64 -d)"`,
  );
}

test('a Qwen Code session starts qwen with its task, reads as the chat, live, and restarts on its own conversation', async ({
  page,
  request,
}) => {
  const up = await request.get(WEB_URL).then(
    (response) => response.ok(),
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetqwen');
  await turnOnForEveryone(api, 'session_chat_view');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'qwen');
  const sessionId = await createSession(api, box.id, installationId, {
    agent: 'qwen',
    launch: { model: 'qwen3.8-max', permission: 'ask' },
    prompt: '-v the empty wallet',
  });

  // Ask is sent, not left to Qwen's own `auto`; the conversation is named by
  // the session; the task is one word, last.
  const terminal = await attach(api, sessionId);
  await terminal.waitFor(
    `QWEN-SHIM argv=--model qwen3.8-max --approval-mode default --session-id ${sessionId} --prompt-interactive=-v the empty wallet`,
    120_000,
  );
  await terminal.close();

  appendQwen(box.host, sessionId, [
    { type: 'system', subtype: 'ui_telemetry', provenance: 'system', systemPayload: {} },
    {
      type: 'assistant',
      provenance: 'assistant_output',
      model: 'qwen3.8-max',
      message: {
        role: 'model',
        parts: [
          { text: 'Run the wallet test first.', thought: true },
          {
            functionCall: {
              id: 'call_1',
              name: 'run_shell_command',
              args: { command: 'pnpm test wallet', description: 'run the test' },
            },
          },
        ],
      },
    },
    {
      type: 'tool_result',
      provenance: 'tool_result',
      message: {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call_1',
              name: 'run_shell_command',
              response: { output: '1 failed' },
            },
          },
        ],
      },
      toolCallResult: { callId: 'call_1', status: 'success' },
    },
    {
      type: 'assistant',
      provenance: 'assistant_output',
      model: 'qwen3.8-max',
      message: { role: 'model', parts: [{ text: 'Found it: `reduce` had no initial value.' }] },
    },
  ]);

  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  const toggle = page.getByRole('group', { name: 'How to read this session' });
  await expect(toggle).toBeVisible({ timeout: 120_000 });
  await toggle.getByRole('button', { name: 'Chat' }).click();

  await expect(
    page.locator('[data-slot="chat-user-message"]').getByText('-v the empty wallet'),
  ).toBeVisible();
  await expect(page.getByText('had no initial value.')).toBeVisible();
  // The turn's work, folded under its reply: the command Qwen ran, as Bash.
  await page.getByRole('button', { name: /Worked for/ }).click();
  await expect(page.getByText('pnpm test wallet')).toBeVisible();

  // A record Qwen writes after the page opened arrives on its own.
  appendQwen(box.host, sessionId, [
    {
      type: 'assistant',
      provenance: 'assistant_output',
      message: { role: 'model', parts: [{ text: 'Fixed and tested.' }] },
    },
  ]);
  await expect(page.getByText('Fixed and tested.')).toBeVisible({ timeout: 15_000 });

  // Restarted once Qwen has written the conversation, it reopens it by id,
  // with no task: another Qwen in the folder may own "the newest".
  expect((await api.post(`/api/v1/sessions/${sessionId}/stop`)).status()).toBeLessThan(300);
  const stoppedAt = async () =>
    (
      (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as {
        stoppedAt: string | null;
      }
    ).stoppedAt;
  await expect.poll(stoppedAt, { timeout: 30_000 }).not.toBeNull();
  expect((await api.post(`/api/v1/sessions/${sessionId}/restart`)).status()).toBeLessThan(300);
  await expect.poll(stoppedAt, { timeout: 60_000 }).toBeNull();
  const restarted = await attach(api, sessionId);
  await restarted.waitFor(
    `QWEN-SHIM argv=--model qwen3.8-max --approval-mode default --resume ${sessionId}`,
    120_000,
  );
  await restarted.close();
});
