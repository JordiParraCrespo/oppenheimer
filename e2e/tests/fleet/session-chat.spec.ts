import { expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { turnOnForEveryone } from '../../support/flags';
import { type FleetHost, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A Claude Code session read as a chat (0.7), on a real runner: the host
 * follows the conversation's transcript where Claude Code keeps it, the relay
 * hands its entries to the attached browser, and the console draws them as
 * turns — the history first, then each line the CLI appends. What the chat's
 * composer sends is typed into the same PTY as the grid. The fleet's `claude`
 * is a shim, so the transcript is written here, line by line as the CLI
 * writes it. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ baseURL: WEB_URL });

const FOLDER = '~/.claude/projects/-w-sessions-xrp-mobile';

const entry = (type: 'user' | 'assistant', uuid: string, content: unknown) =>
  JSON.stringify({
    type,
    uuid,
    timestamp: '2026-10-21T09:12:00.000Z',
    message:
      type === 'assistant'
        ? { role: 'assistant', model: 'claude-opus-5-5', content }
        : { role: 'user', content },
  });

/** Appends lines to the conversation's transcript on the host, as the CLI would. */
function append(host: FleetHost, sessionId: string, lines: string[]): void {
  const body = Buffer.from(`${lines.join('\n')}\n`).toString('base64');
  host.exec(`mkdir -p ${FOLDER} && echo ${body} | base64 -d >> ${FOLDER}/${sessionId}.jsonl`);
}

async function screenText(page: Page): Promise<string> {
  return (await page.locator('.xterm-rows').textContent()) ?? '';
}

test('the console reads a Claude Code session as a chat, live, and types into its terminal', async ({
  page,
}) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetchat');
  await turnOnForEveryone(api, 'session_chat_view');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'chat');
  const sessionId = await createSession(api, box.id, installationId);
  append(box.host, sessionId, [
    entry('user', 'u1', 'Fix the empty wallet'),
    entry('assistant', 'a1', [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'pnpm test wallet' } },
    ]),
    entry('user', 'r1', [
      { type: 'tool_result', tool_use_id: 't1', content: '1 failed', is_error: true },
    ]),
    entry('assistant', 'a2', [{ type: 'text', text: 'Found it: `reduce` had no initial value.' }]),
  ]);

  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  const toggle = page.getByRole('group', { name: 'How to read this session' });
  await expect(toggle).toBeVisible({ timeout: 120_000 });
  await toggle.getByRole('button', { name: 'Chat' }).click();

  await expect(page.getByText('Fix the empty wallet')).toBeVisible();
  await expect(page.getByText('pnpm test wallet')).toBeVisible();
  await expect(page.getByText('had no initial value.')).toBeVisible();

  // A line the agent writes after the page opened arrives on its own.
  append(box.host, sessionId, [
    entry('assistant', 'a3', [{ type: 'text', text: 'Fixed and tested.' }]),
  ]);
  await expect(page.getByText('Fixed and tested.')).toBeVisible({ timeout: 15_000 });

  // The composer types into the terminal: the shim's shell runs it.
  await page
    .getByPlaceholder('Message Claude. It is typed into the terminal.')
    .fill('echo chat-$((6*7))');
  await page.keyboard.press('Enter');
  await toggle.getByRole('button', { name: 'Terminal' }).click();
  await expect.poll(() => screenText(page), { timeout: 15_000 }).toContain('chat-42');
});
