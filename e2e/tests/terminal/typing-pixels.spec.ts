import { type Browser, expect, type Page, test } from '@playwright/test';
import { serveTerminalPage, type TerminalPage } from './page/serve';

/**
 * What a reader sees while typing ahead of a slow host: the console's
 * predictive echo draws each key at once, and the host's echo replaces it a
 * round trip later. Nothing on screen may move when it does, neither the
 * letters nor the caret. A guess drawn a pixel above the echo read as every
 * letter being typed twice, the second time lower.
 *
 * The page (`page/`) is the console's own session terminal on a fake host
 * whose echo the test holds. Each case photographs the screen with the guess
 * drawn, lets the echo go, photographs it again, and compares the two. It
 * needs Chromium and nothing else: no API, no runner.
 *
 * What it cannot see: the WebGL renderer above 1x. Headless Chromium draws
 * that canvas blank (read back from inside the page, too), so WebGL runs at
 * 1x only, and `typeahead-webgl-baseline.spec.ts` in `apps/web` holds the
 * rule the overlay follows there at every pixel ratio.
 */

/** Installed faces, served under a name the terminal's font stack asks for. */
const FACES = ['', 'Liberation Mono', 'FreeMono', 'DejaVu Sans Mono'];

interface Case {
  renderer: 'dom' | 'webgl';
  dpr: number;
  mode: 'caret' | 'inverse';
  face: string;
}

const CASES: Case[] = [];
for (const face of FACES) {
  for (const mode of ['caret', 'inverse'] as const) {
    for (const dpr of [1, 1.25, 1.5, 2]) CASES.push({ renderer: 'dom', dpr, mode, face });
    CASES.push({ renderer: 'webgl', dpr: 1, mode, face });
  }
}

/** Pixels allowed to differ by more than `CHANNEL` between the two frames: anti-aliasing, never a glyph. */
const SPECKLE = 12;
const CHANNEL = 64;
/** Longer than the typeahead waits before dropping an unconfirmed guess (`terminal-echo.ts`). */
const EXPIRY_MS = 2000;

let served: TerminalPage;

test.beforeAll(async () => {
  served = await serveTerminalPage();
});

test.afterAll(async () => {
  await served?.close();
});

for (const c of CASES) {
  const name = `${c.renderer} ${c.dpr}x, ${c.mode}, ${c.face || 'default face'}`;

  test(`a predicted key does not move when its echo lands (${name})`, async ({ browser }) => {
    await typeAhead(browser, c, async (page) => {
      await page.keyboard.type('Wg');
    });
  });
}

// Deleting is the same at every ratio and face; what matters is where the
// prompt ends. Five Backspaces after three letters: the last two are the
// host's to refuse, and a guess that deleted the prompt sprang back.
for (const c of CASES.filter((c) => c.dpr === 1 && c.face === '')) {
  test(`deleting past the prompt does not bounce (${c.renderer}, ${c.mode})`, async ({
    browser,
  }) => {
    await typeAhead(browser, c, async (page) => {
      for (let i = 0; i < 5; i += 1) await page.keyboard.press('Backspace');
    });
  });
}

// A guess hands the cursor back to the terminal when its echo lands. Done
// out of step, every echo left a frame with no cursor at all, and typing at
// an ordinary pace made the cursor blink. Every painted frame is sampled
// while twenty keys are typed: exactly one cursor, always. Once on a quiet
// host, and once on a busy one whose output lands while the cursor is being
// handed back. The DOM renderer only, where the terminal's own cursor is an
// element the page can see.
for (const busy of [false, true]) {
  test(`the cursor never blinks out while typing ahead of the host (dom, caret${busy ? ', busy host' : ''})`, async ({
    browser,
  }) => {
    await countCursors(browser, busy);
  });
}

async function countCursors(browser: Browser, busy: boolean) {
  const c: Case = { renderer: 'dom', dpr: 1, mode: 'caret', face: '' };
  const { context, page } = await open(browser, c, busy);
  for (const key of 'abc') {
    await page.keyboard.type(key);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.harness.watchCursors());
  for (const key of 'the quick brown fox ') {
    await page.keyboard.type(key);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => window.harness.stopWatching());
  expect(frames.length, 'frames sampled').toBeGreaterThan(60);
  expect(frames.filter((n) => n === 0).length, 'frames with no cursor').toBe(0);
  expect(frames.filter((n) => n > 1).length, 'frames with two cursors').toBe(0);
  await context.close();
}

/** A page with the terminal for `c`, on the case's renderer, focused. */
async function open(browser: Browser, c: Case, busy = false) {
  const context = await browser.newContext({
    deviceScaleFactor: c.dpr,
    viewport: { width: 700, height: 160 },
  });
  // The renderer is the case's, not the machine's. WebGL: Linux browsers with
  // a software GL stay on the DOM renderer (`terminal-webgl-policy.ts`), so
  // this one says it is a Mac. DOM: a Mac, or a hardware GL, would attach
  // WebGL, so this one has no WebGL2 context to give it (the addon then
  // fails to construct, and the terminal stays on DOM, as on a real failure).
  if (c.renderer === 'webgl') {
    await context.addInitScript(() =>
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' }),
    );
  } else {
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
        return args[0] === 'webgl2' ? null : getContext.apply(this, args as never);
      } as typeof getContext;
    });
  }
  const page = await context.newPage();
  const query = new URLSearchParams({ mode: c.mode, face: c.face, spin: busy ? '1' : '' });
  await page.goto(`${served.origin}/?${query}`);
  await page.waitForFunction(() => 'harness' in window);
  await expect.poll(() => page.evaluate(() => window.harness.renderer())).toBe(c.renderer);
  await page.locator('#terminal').click();
  return { context, page };
}

/**
 * Opens the terminal for `c`, types three keys the host echoes, then holds
 * the host, does `keys`, and photographs the screen with the guess drawn and
 * again once the echo has landed: the two must be the same picture.
 */
async function typeAhead(browser: Browser, c: Case, keys: (page: Page) => Promise<void>) {
  const { context, page } = await open(browser, c);

  // Keys the host echoes after 60 ms each, far apart: round trips for the
  // latency the typeahead waits on, and an echo that confirms the line.
  for (const key of 'abc') {
    await page.keyboard.type(key);
    await page.waitForTimeout(250);
  }
  const settled = await screen(page);

  await page.evaluate(() => window.harness.host.hold());
  const echoes = await page.evaluate(() => window.harness.host.echoes);
  await keys(page);
  await page.waitForTimeout(100);
  const predicted = await screen(page);
  await page.evaluate(() => window.harness.host.release());
  await expect.poll(() => page.evaluate(() => window.harness.host.echoes)).toBe(echoes + 1);
  await page.waitForTimeout(150);
  const echoed = await screen(page);
  // Past the moment a guess the host never confirmed is dropped (a second, or
  // four round trips): a wrong guess outlives the echo and only then springs
  // back, so the picture is taken again once nothing can still be pending.
  await page.waitForTimeout(EXPIRY_MS);
  const later = await screen(page);

  // The guess was drawn before the echo (or this proves nothing), the echo
  // looks exactly like it, and so does the screen once every guess is gone.
  expect(await differing(page, settled, predicted), 'the prediction drew').toBeGreaterThan(SPECKLE);
  expect(await differing(page, predicted, echoed), 'pixels that moved').toBeLessThanOrEqual(
    SPECKLE,
  );
  expect(await differing(page, predicted, later), 'pixels that sprang back').toBeLessThanOrEqual(
    SPECKLE,
  );
  await context.close();
}

async function screen(page: Page): Promise<string> {
  const clip = await page.evaluate(() => window.harness.screen());
  return (await page.screenshot({ clip })).toString('base64');
}

/** How many pixels differ by more than `CHANNEL` in any channel, decoded in the page. */
function differing(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    async ({ a, b, channel }) => {
      const pixels = async (base64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [left, right] = await Promise.all([pixels(a), pixels(b)]);
      if (left.length !== right.length) return Number.POSITIVE_INFINITY;
      let count = 0;
      for (let i = 0; i < left.length; i += 4) {
        const delta = Math.max(
          Math.abs((left[i] ?? 0) - (right[i] ?? 0)),
          Math.abs((left[i + 1] ?? 0) - (right[i + 1] ?? 0)),
          Math.abs((left[i + 2] ?? 0) - (right[i + 2] ?? 0)),
        );
        if (delta > channel) count += 1;
      }
      return count;
    },
    { a, b, channel: CHANNEL },
  );
}
