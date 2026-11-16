import { expect, test } from '@playwright/test';
import { serveTerminalPage, type TerminalPage } from './page/serve';

/**
 * The reader's message is drawn as a bubble over the grid (`user-turns.ts`).
 * When the agent redraws its screen, as Claude Code does on every Enter, the
 * message moves to another row, and the bubble has to move in the same
 * painted frame. Moved a frame after the grid, it sat over the wrong row for
 * that frame and the pane read as jumping each time a message was sent.
 */

let served: TerminalPage;

test.beforeAll(async () => {
  served = await serveTerminalPage();
});

test.afterAll(async () => {
  await served?.close();
});

/** Claude Code's user message: its grey (palette 237 through tmux), the pointer, the text. */
const message = (row: number) =>
  `\u001b[2J\u001b[${row + 1};1H\u001b[48;5;237m❯ hello\u001b[K\u001b[0m\u001b[6;1H`;

test('a message the agent redraws on another row keeps its bubble in the same frame', async ({
  page,
}) => {
  await page.goto(`${served.origin}/?agent=1`);
  await page.waitForFunction(() => 'harness' in window);
  await page.evaluate((first) => window.harness.host.print(first), message(3));
  await page.waitForTimeout(200);

  await page.evaluate(() => window.harness.watchBubbles('hello'));
  for (let i = 0; i < 20; i += 1) {
    const row = i % 2 === 0 ? 1 : 3;
    await page.evaluate((redraw) => window.harness.host.print(redraw), message(row));
    await page.waitForTimeout(80);
  }
  const frames = await page.evaluate(() => window.harness.stopWatchingBubbles());

  const drawn = frames.filter((frame) => frame.grid >= 0);
  expect(drawn.length, 'frames sampled').toBeGreaterThan(60);
  expect(
    drawn.filter((frame) => frame.bubble !== frame.grid),
    'frames whose bubble is off its message',
  ).toEqual([]);
});
