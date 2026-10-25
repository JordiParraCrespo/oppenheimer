import { expect, test } from '@playwright/test';
import { serveTerminalPage, type TerminalPage } from './page/serve';

/**
 * A URL the agent prints is a link: a click on it opens it in a new tab.
 * tmux runs with `mouse on`, so the terminal is in mouse-reporting mode the
 * whole time; the link has to open anyway.
 */

let served: TerminalPage;

test.beforeAll(async () => {
  served = await serveTerminalPage();
});

test.afterAll(async () => {
  await served?.close();
});

test('a printed URL opens in a new tab on click, with tmux reporting the mouse', async ({
  context,
  page,
}) => {
  await page.goto(served.origin);
  await page.waitForFunction(() => 'harness' in window);
  const url = `${served.origin}/linked?from=terminal`;
  // What tmux sends on attach with `mouse on`: button tracking, SGR encoding.
  await page.evaluate(
    (url) => window.harness.host.print(`\u001b[?1000h\u001b[?1006h\u001b[2J\u001b[H${url}`),
    url,
  );

  const row = page.locator('.xterm-rows > div').first();
  await expect(row).toContainText(url);
  // The centre of the URL as drawn, whatever the face's metrics.
  const { x, y } = await row.evaluate((element, url) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const at = (element.textContent ?? '').indexOf(url);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let offset = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent?.length ?? 0;
      if (offset <= at && at < offset + length) range.setStart(node, at - offset);
      if (offset < at + url.length && at + url.length <= offset + length) {
        range.setEnd(node, at + url.length - offset);
      }
      offset += length;
    }
    const box = range.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }, url);
  // xterm finds the link under the pointer as it moves, then opens it on the
  // click that follows.
  await page.mouse.move(x, y);
  const opened = context.waitForEvent('page');
  await page.mouse.click(x, y);
  const tab = await opened;
  await tab.waitForURL(url);
});
