import { expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { appendTranscript, transcriptEntry as entry } from '../../support/session-chat';
import { connectInstallation, createSession } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * A session's decision answered from the Inbox (`29-inbox.md` slice 4), on a
 * real runner: the runner reads what the agent waits on (a permission dialog
 * off the screen, an `AskUserQuestion` call off the transcript), the API keeps
 * it on the session, the Inbox draws it as a card, and the answer is typed
 * into the session's terminal as the keys a person would press. The fleet's
 * `claude` is a shim that hands the pane to a shell, so the dialog is printed
 * there, the question is written to the transcript, and the shell reads what
 * the answer typed and prints it back. Needs the console on `WEB_URL`.
 *
 * `INBOX_SCREENS=1` saves each card, light and dark, at 1440 and 390 wide,
 * into `../.screenshots/`.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ baseURL: WEB_URL });

/** Everything the session's terminal drew while the page was attached, as text. */
function watchScreen(page: Page): () => string {
  let screen = '';
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') {
        screen = (screen + frame.payload.toString()).slice(-200_000);
      }
    });
  });
  return () => screen;
}

/** Opens the session's terminal and runs `command` in the shim's shell. */
async function runInSession(page: Page, screen: () => string, sessionId: string, command: string) {
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => screen().includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);
  await expect(linkLive(page)).toBeVisible();
  await page.locator('.xterm').first().click();
  await page.keyboard.type(command);
  await page.keyboard.press('Enter');
}

/** The session's row in the Inbox, once the API counts it as waiting on you (30 s blocked). */
async function openInboxItem(page: Page) {
  await page.goto('/plan/inbox');
  const row = page.locator('[data-slot="inbox-row"]', { hasText: 'is waiting on you' });
  await expect(async () => {
    await page.reload();
    await expect(row).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  await row.click();
  return row;
}

async function photograph(page: Page, name: string) {
  if (!process.env.INBOX_SCREENS) return;
  const card = page.locator('[data-slot="inbox-message"]');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `../.screenshots/${name}-${width}-${theme}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
}

async function consoleUp(): Promise<boolean> {
  return fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
}

/** Octal escapes for printf, so the command typed into the terminal is plain ASCII. */
const RULE = '\\342\\224\\200'.repeat(40);
const CURSOR = '\\342\\235\\257';

test('a permission dialog is answered from its Inbox card, and the session receives the option', async ({
  page,
}) => {
  test.skip(!(await consoleUp()), `the console is not running on ${WEB_URL}`);
  const { api, user } = await signedUpContext('fleetperm');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'perm');
  const sessionId = await createSession(api, box.id, installationId);
  const screen = watchScreen(page);
  await signInAs(page, user);

  // Claude Code 2.x's dialog before a tool runs, and a shell that takes one
  // key, as the dialog does, and says which (the shim's shell is `sh`).
  const dialog = [
    RULE,
    ' Bash command',
    '',
    '   pnpm generate:api-client',
    '   Regenerate the typed API client',
    '',
    ' Do you want to proceed?',
    ` ${CURSOR} 1. Yes`,
    '   2. Yes, and don\\047t ask again for pnpm commands',
    '   3. No, and tell Claude what to do differently (esc)',
    '',
  ].join('\\n');
  await runInSession(
    page,
    screen,
    sessionId,
    `clear; printf '${dialog}\\n'; stty raw -echo; a=$(head -c 1); stty sane; clear; echo "GOT:$a"`,
  );
  await expect(page.locator('.xterm-rows')).toContainText('Do you want to proceed?');

  await openInboxItem(page);
  const card = page.locator('[data-slot="inbox-message"]');
  await expect(card.getByRole('heading', { name: 'Do you want to proceed?' })).toBeVisible();
  await expect(card.locator('[data-slot="approval-command"]')).toContainText(
    'pnpm generate:api-client',
  );
  const choices = card.locator('[data-slot="inbox-message-choices"]').getByRole('button');
  await expect(choices).toHaveText([
    'Yes',
    "Yes, and don't ask again for pnpm commands",
    'No, and tell Claude what to do differently (esc)',
  ]);
  await expect(card.getByRole('link', { name: 'Open session' })).toBeVisible();
  await photograph(page, 'inbox-permission');

  await choices.getByText('Yes', { exact: true }).click();
  await expect(card).toHaveCount(0);

  // The answer was the key "1", typed into the session.
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => screen().includes('GOT:1'), { timeout: 30_000 }).toBe(true);
});

test('an agent question is answered from its Inbox card with the keys its picker takes, and leaves once answered', async ({
  page,
}) => {
  test.skip(!(await consoleUp()), `the console is not running on ${WEB_URL}`);
  const { api, user } = await signedUpContext('fleetquestion');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'question');
  const sessionId = await createSession(api, box.id, installationId);
  const append = (lines: string[]) => appendTranscript(box.host, sessionId, lines);
  const screen = watchScreen(page);
  await signInAs(page, user);

  append([
    entry('user', 'u1', 'Ship the wallet screen'),
    entry('assistant', 'a1', [
      {
        type: 'tool_use',
        id: 'toolu_inbox_1',
        name: 'AskUserQuestion',
        input: {
          questions: [
            {
              header: 'Scope',
              question: 'Which screens should change?',
              multiSelect: false,
              options: [
                { label: 'Wallet only', description: 'The balance and the list' },
                { label: 'Every tab', description: 'Wallet, Swap and Settings' },
              ],
            },
            {
              header: 'Platforms',
              question: 'Which platforms ship it?',
              multiSelect: true,
              options: [{ label: 'iOS' }, { label: 'Android' }, { label: 'Web' }],
            },
          ],
        },
      },
    ]),
  ]);

  // The answer below is "Every tab", then iOS and Web and "Linux" of its own:
  // `questionKeys` (`@oppenheimer/shared/sessions`) types "2"; "1", "3", Down
  // past the three options to the own-answer row, "Linux", Down (ticking it),
  // Enter; then "1" on the review. 22 bytes, each its own write.
  const DOWN = '1b5b42';
  const expected = ['32', '31', '33', DOWN, DOWN, DOWN, '4c696e7578', DOWN, '0d', '31'].join('');
  const bytes = expected.length / 2;
  // A blocked agent says so on screen; the shell then reads raw bytes, as the
  // picker does, and prints them back in hex.
  await runInSession(
    page,
    screen,
    sessionId,
    `clear; printf 'Claude is waiting for your input\\n'; stty raw -echo; head -c ${bytes} > /tmp/inbox-keys-$$; stty sane; clear; printf 'GOT:'; od -An -tx1 /tmp/inbox-keys-$$ | tr -d ' \\n'; echo`,
  );
  await expect(page.locator('.xterm-rows')).toContainText('waiting for your input');

  await openInboxItem(page);
  const card = page.locator('[data-slot="inbox-message"]');
  await expect(
    card.getByRole('heading', { name: /^2 questions before .+ continues$/ }),
  ).toBeVisible();
  const questions = card.locator('[data-slot="inbox-question"]');
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toContainText('Which screens should change?');
  await expect(questions.nth(0)).toContainText('Wallet, Swap and Settings');
  const send = card.getByRole('button', { name: 'Send answers' });
  await expect(send).toBeDisabled();

  await questions
    .nth(0)
    .getByRole('button', { name: /^Every tab/ })
    .click();
  await expect(send).toBeDisabled();
  await photograph(page, 'inbox-question');

  await questions.nth(1).getByRole('button', { name: 'iOS' }).click();
  await questions.nth(1).getByRole('button', { name: 'Web' }).click();
  await questions.nth(1).getByRole('textbox').fill('Linux');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(card).toHaveCount(0);

  // The session received exactly the picker's keys.
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => screen().includes(`GOT:${expected}`), { timeout: 30_000 }).toBe(true);

  // The agent takes the answer; once its call has a result the session waits on nothing.
  append([
    entry('user', 'r1', [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_inbox_1',
        content: 'User has answered your questions.',
      },
    ]),
  ]);
  await page.goto('/plan/inbox');
  const row = page.locator('[data-slot="inbox-row"]', { hasText: 'is waiting on you' });
  await expect(async () => {
    await page.reload();
    await expect(page.locator('[data-slot="inbox-list-head"]')).toBeVisible();
    await expect(row).toHaveCount(0);
  }).toPass({ timeout: 90_000, intervals: [5_000] });
});
