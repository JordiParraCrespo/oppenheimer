import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { turnOnForEveryone } from '../../support/flags';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A Hermes session on a real runner, from the composer's choice to the Chat
 * tab. Hermes keeps its conversations in a SQLite database rather than a
 * transcript file, so what only a real runner shows is the whole trip: the
 * session starts `hermes chat --query <task>` in its worktree, the runner
 * finds the conversation Hermes started there in `~/.hermes/state.db`, and the
 * console draws its rows as the chat, then each row written after it opened.
 * Every host carries a `hermes` shim (`e2e/fleet/hermes`) that writes the
 * conversation's first rows as Hermes does; the rest is written here. Needs
 * the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({
  baseURL: WEB_URL,
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
});

/** Adds rows to the host's Hermes conversation, newest first, as Hermes would. */
function appendHermes(host: { exec: (commandLine: string) => string }, rows: object[]): void {
  const script = `
import json, os, sqlite3, sys, time
home = os.environ.get("HERMES_HOME") or os.path.join(os.path.expanduser("~"), ".hermes")
db = sqlite3.connect(os.path.join(home, "state.db"))
session = db.execute("SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1").fetchone()[0]
for row in json.loads(sys.argv[1]):
    db.execute("INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, reasoning, timestamp)"
               " VALUES (?, ?, ?, ?, ?, ?, ?)", (session, row["role"], row.get("content"),
               json.dumps(row["tool_calls"]) if "tool_calls" in row else None,
               row.get("tool_call_id"), row.get("reasoning"), time.time()))
db.commit()
`;
  const encoded = Buffer.from(script).toString('base64');
  const payload = Buffer.from(JSON.stringify(rows)).toString('base64');
  host.exec(`python3 -c "$(echo ${encoded} | base64 -d)" "$(echo ${payload} | base64 -d)"`);
}

test('a Hermes session starts hermes with its task, and its conversation reads as the chat, live', async ({
  page,
}) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleethermes');
  await turnOnForEveryone(api, 'session_chat_view');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'hermes');
  const sessionId = await createSession(api, box.id, installationId, {
    agent: 'hermes',
    prompt: 'Fix the empty wallet',
  });

  // No model, permission or effort: `hermes chat` and the task, nothing else.
  const terminal = await attach(api, sessionId);
  await terminal.waitFor('HERMES-SHIM argv=chat --query Fix the empty wallet', 120_000);
  await terminal.close();

  appendHermes(box.host, [
    {
      role: 'assistant',
      content: '',
      reasoning: 'Run the wallet test first.',
      tool_calls: [
        {
          id: 'c1',
          type: 'function',
          function: {
            name: 'terminal',
            arguments: JSON.stringify({ command: 'pnpm test wallet' }),
          },
        },
      ],
    },
    { role: 'tool', tool_call_id: 'c1', content: '{"output": "1 failed", "exit_code": 1}' },
    { role: 'assistant', content: 'Found it: `reduce` had no initial value.' },
  ]);

  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  const toggle = page.getByRole('group', { name: 'How to read this session' });
  await expect(toggle).toBeVisible({ timeout: 120_000 });
  await toggle.getByRole('button', { name: 'Chat' }).click();

  await expect(
    page.locator('[data-slot="chat-user-message"]').getByText('Fix the empty wallet'),
  ).toBeVisible();
  await expect(page.getByText('had no initial value.')).toBeVisible();
  // The turn's work, folded under its reply: the command Hermes ran, as Bash.
  await page.getByRole('button', { name: /Worked for/ }).click();
  await expect(page.getByText('pnpm test wallet')).toBeVisible();

  // A row Hermes writes after the page opened arrives on its own.
  appendHermes(box.host, [{ role: 'assistant', content: 'Fixed and tested.' }]);
  await expect(page.getByText('Fixed and tested.')).toBeVisible({ timeout: 15_000 });
});
