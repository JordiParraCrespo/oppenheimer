import { expect, type Locator, type Page } from '@playwright/test';

/** Where a host's Claude Code keeps conversations; the runner finds one in any project folder. */
const FOLDER = '~/.claude/projects/-w-sessions-xrp-mobile';

/** One line of a Claude Code transcript, as the CLI writes it. */
export const transcriptEntry = (type: 'user' | 'assistant', uuid: string, content: unknown) =>
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
export function appendTranscript(
  host: { exec: (commandLine: string) => string },
  sessionId: string,
  lines: string[],
): void {
  const body = Buffer.from(`${lines.join('\n')}\n`).toString('base64');
  host.exec(`mkdir -p ${FOLDER} && echo ${body} | base64 -d >> ${FOLDER}/${sessionId}.jsonl`);
}

/** `count` prompt-and-answer turns, each answer long enough to take a screen's share. */
export function longTurns(prefix: string, count: number): string[] {
  const paragraph = 'The reducer folds every entry into the running total. '.repeat(12);
  return Array.from({ length: count }, (_, i) => [
    transcriptEntry('user', `${prefix}-u${i}`, `${prefix} question ${i}`),
    transcriptEntry('assistant', `${prefix}-a${i}`, [
      { type: 'text', text: `${prefix} answer ${i}. ${paragraph}` },
    ]),
  ]).flat();
}

/** The chat's scrolling column: the box that scrolls around the transcript. */
function scroller(page: Page): Locator {
  return page.locator('.overflow-y-auto:has([data-slot="chat-transcript"])').first();
}

/** How far the chat's column sits from its end, in pixels. */
async function distanceFromEnd(page: Page): Promise<number> {
  return scroller(page).evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
}

/**
 * Nothing of the terminal under the chat paints or takes a pointer over it:
 * the topmost element at points across the chat's area is the chat's own,
 * never xterm's layers (a z-index inside the grid once reached over the
 * cover, greying a band and eating clicks).
 */
export async function expectChatOnTop(page: Page): Promise<void> {
  const box = await scroller(page).boundingBox();
  if (!box) throw new Error('the chat is not on screen');
  const leaks = await page.evaluate((b) => {
    // Some of those layers take no pointer, so hit-testing skips them while
    // they still paint: for the sampling, everything of the terminal takes
    // one, which makes the topmost element the topmost painted.
    const probe = document.createElement('style');
    probe.textContent = '.xterm, .xterm * { pointer-events: auto !important; }';
    document.head.appendChild(probe);
    const found: string[] = [];
    for (let x = b.x + 4; x < b.x + b.width; x += b.width / 12) {
      for (let y = b.y + 4; y < b.y + b.height; y += b.height / 12) {
        const el = document.elementFromPoint(x, y);
        if (el?.closest('.xterm')) {
          found.push(
            `${Math.round(x)},${Math.round(y)}: ${el.className || el.getAttribute('style') || el.tagName}`,
          );
        }
      }
    }
    probe.remove();
    return found;
  }, box);
  expect(leaks, 'terminal layers over the chat').toEqual([]);
}

/**
 * The chat follows the newest turn, stays put once the reader scrolls back,
 * offers the way back, and follows again once taken there. `append` writes
 * transcript lines on the host.
 */
export async function expectChatFollows(
  page: Page,
  append: (lines: string[]) => void,
  { composer: withComposer = true }: { composer?: boolean } = {},
): Promise<void> {
  append(longTurns('history', 12));
  await expect(page.getByText('history answer 11.')).toBeInViewport({ timeout: 30_000 });
  await expect.poll(() => distanceFromEnd(page)).toBeLessThan(96);

  // The reader scrolls back to read; a new turn does not pull them down.
  await scroller(page).hover();
  await page.mouse.wheel(0, -2_000);
  const latest = page.getByRole('button', { name: 'Jump to latest' });
  await expect(latest).toBeVisible();
  append(longTurns('while-away', 1));
  await expect(page.getByText('while-away answer 0.')).toBeAttached({ timeout: 30_000 });
  await expect(page.getByText('while-away answer 0.')).not.toBeInViewport();
  await expect(latest).toBeVisible();

  // The chip takes them to the end, and the chat follows from there.
  await latest.click();
  await expect(latest).toBeHidden();
  await expect.poll(() => distanceFromEnd(page)).toBeLessThan(96);
  append(longTurns('after', 2));
  await expect(page.getByText('after answer 1.')).toBeInViewport({ timeout: 30_000 });
  await expect.poll(() => distanceFromEnd(page)).toBeLessThan(96);

  // A view-only chat has no composer to grow.
  if (!withComposer) return;

  // A draft that grows the composer shrinks the column; the end stays in view.
  const composer = page.getByPlaceholder('Message Claude');
  await composer.fill(Array.from({ length: 8 }, (_, i) => `line ${i}`).join('\n'));
  await expect.poll(() => distanceFromEnd(page)).toBeLessThan(96);
  await expect(page.getByText('after answer 1.')).toBeInViewport();
  await composer.fill('');
}

/** The composer takes a click and typing, which a layer over it would swallow. */
export async function expectComposerClickable(page: Page): Promise<Locator> {
  const composer = page.getByPlaceholder('Message Claude');
  await composer.click();
  await expect(composer).toBeFocused();
  return composer;
}
