import { expect, type Page, test, type WebSocketRoute } from '@playwright/test';
import { query } from '../../support/db';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The session screen, `/sessions/{id}`, in each state the URL can land on —
 * without a runner. Pairing here is a keypair and a row (`support/sessions.ts`),
 * so a session stays `starting` for ever, and two things stand in for the
 * runner, and only those:
 *
 * - **The lifecycle a runner would report** is written to the session's row —
 *   `open` once it has built the worktree, `stoppedAt` once tmux is gone —
 *   because only a runner's link can set it. Pairing, the installation, the
 *   session and the attach ticket all go through the real API.
 * - **The relay's attach socket**, in the one test about what the terminal
 *   draws, is answered in the browser (`page.routeWebSocket`) with a recorded
 *   transcript in the `01-protocol.md` wire format, because the console always
 *   builds the real `AttachSessionStream`.
 *
 * The same screen on a real runner, through the real relay, is
 * `tests/fleet/console.spec.ts`.
 */

/** The grid, read off xterm's DOM renderer. */
function grid(page: Page) {
  return page.locator('.xterm-rows');
}

/**
 * Keep xterm on its DOM renderer, whose cells are text a test can read. WebGL
 * draws the same grid onto a canvas; `terminal-runtime.ts` falls back to the
 * DOM renderer whenever a WebGL2 context cannot be had, which is the path this
 * takes.
 */
async function withoutWebgl(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...rest: unknown[]
    ) {
      if (kind === 'webgl2') return null;
      return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  });
}

/** What a runner reports once it has built the worktree and started tmux. */
async function markOpen(sessionId: string) {
  await query(`UPDATE "work_session" SET "state" = 'open' WHERE "id" = $1`, [sessionId]);
}

/** What a runner reports once the session's tmux is gone and its checkouts are kept. */
async function markStopped(sessionId: string) {
  await query(`UPDATE "work_session" SET "stoppedAt" = now() WHERE "id" = $1`, [sessionId]);
}

const ESC = '\u001b[';
/** A short recorded session, with the colours a real agent emits. */
const TRANSCRIPT = [
  `${ESC}90m[tmux] attached to session e2e — window 0${ESC}0m\r\n`,
  `${ESC}34m$ ${ESC}0mpnpm arch\r\n`,
  `${ESC}32m✓${ESC}0m packages/frontend — no boundary violations\r\n`,
  `${ESC}34m$ ${ESC}0m`,
];

test.describe('Session screen', () => {
  test('a session the host has not built waits, and an open one on an offline host says so', async ({
    page,
  }) => {
    test.slow();
    const owner = await provisionedUser('sessionstates');
    const hostId = await pairHost(owner.api, 'Quiet box');
    const installationId = await connectInstallation(owner.api);
    const sessionId = await createSession(owner.api, hostId, installationId);

    await signInAs(page, owner.user);
    await page.goto(`/sessions/${sessionId}`);

    // `starting`: no PTY yet, so the provisioning pane rather than a terminal.
    await expect(page.getByRole('heading', { name: 'Starting your session' })).toBeVisible();
    // The steps are the host's, starting with reaching it.
    await expect(page.getByText('Connect to Quiet box')).toBeVisible();
    await expect(page.getByText('Start Claude Code')).toBeVisible();
    await expect(page.getByText('Working…')).toBeVisible();
    await expect(page.locator('.xterm')).toHaveCount(0);

    // `open`: a terminal, whose attach socket is the real relay's. The host
    // holds no link, so the relay answers `host_offline` and the pane says so
    // and offers to try again, rather than sitting on "Connecting".
    await markOpen(sessionId);
    await page.reload();
    await expect(page.locator('.xterm')).toBeVisible();
    await expect(page.getByText('Host offline', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Retry now' })).toBeVisible();

    // `stoppedAt`: over, and the pane says where the work is.
    await markStopped(sessionId);
    await page.reload();
    await expect(
      page.getByText('This session has stopped. Its work is on its branch.'),
    ).toBeVisible();
    await expect(page.locator('.xterm')).toHaveCount(0);
    await page.getByRole('link', { name: 'New session' }).last().click();
    await expect(page).toHaveURL(/\/sessions\/new$/);

    await owner.api.dispose();
  });

  test('the terminal draws what the stream sends, echoes keys, and gives way when it stops', async ({
    page,
  }) => {
    test.slow();
    const owner = await provisionedUser('sessionstream');
    const hostId = await pairHost(owner.api, 'Stream box');
    const installationId = await connectInstallation(owner.api);
    const sessionId = await createSession(owner.api, hostId, installationId);
    await markOpen(sessionId);

    // The relay, stood in for: attach, replay the transcript, then behave like
    // a shell — echo what was typed, answer Enter with a new prompt. Control
    // frames from the console are kept to assert on.
    const controls: { type?: string }[] = [];
    let relay: WebSocketRoute | undefined;
    await page.routeWebSocket(/\/api\/v1\/relay\/attach/, (socket) => {
      relay = socket;
      socket.onMessage((message) => {
        if (typeof message === 'string') {
          controls.push(JSON.parse(message) as { type?: string });
          return;
        }
        const typed = message.toString('utf8');
        socket.send(Buffer.from(typed === '\r' ? `\r\n${ESC}34m$ ${ESC}0m` : typed));
      });
      socket.send(JSON.stringify({ type: 'attached', window: 0 }));
      for (const chunk of TRANSCRIPT) socket.send(Buffer.from(chunk));
    });
    await withoutWebgl(page);

    await signInAs(page, owner.user);
    await page.goto(`/sessions/${sessionId}`);

    await expect(page.getByText('Live', { exact: true })).toBeVisible();
    await expect(grid(page)).toContainText('[tmux] attached to session e2e — window 0');
    await expect(grid(page)).toContainText('✓ packages/frontend — no boundary violations');

    // A key is drawn because the far end sent it back, not because the
    // browser drew it.
    await page.locator('.xterm').click();
    await page.keyboard.type('echo e2e-typed');
    await expect(grid(page)).toContainText('$ echo e2e-typed');

    expect(controls.some((frame) => frame.type === 'resize')).toBe(true);
    await expect.poll(() => controls.some((frame) => frame.type === 'credit')).toBe(true);

    // The host stops the session: the relay says so and closes. The console
    // refetches, finds it stopped, and the terminal gives way.
    await markStopped(sessionId);
    relay?.send(JSON.stringify({ type: 'closed', reason: 'stopped' }));
    await relay?.close({ code: 4410, reason: 'stopped' });
    await expect(
      page.getByText('This session has stopped. Its work is on its branch.'),
    ).toBeVisible();
    await expect(page.locator('.xterm')).toHaveCount(0);

    await owner.api.dispose();
  });

  test('an id that does not exist is a not-found page with the way to a new session', async ({
    page,
  }) => {
    const owner = await provisionedUser('sessionmissing');
    await signInAs(page, owner.user);

    await page.goto('/sessions/00000000-0000-4000-8000-000000000000');

    // A 404 is a destination that will never exist, not a failure to retry.
    await expect(page.getByText('That page does not exist')).toBeVisible();
    await expect(page.locator('.xterm')).toHaveCount(0);
    await page.getByRole('link', { name: 'New session' }).last().click();
    await expect(page).toHaveURL(/\/sessions\/new$/);

    await owner.api.dispose();
  });
});
