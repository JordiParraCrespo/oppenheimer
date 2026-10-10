import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Typing in the console's terminal on a real runner, timed: for each key, when
 * its echo came back over the attach socket and when a glyph for it was on
 * screen. The echo pays the relay twice (browser to API, API to runner); the
 * glyph should not, because the terminal draws a key it can predict
 * (`local-echo.ts`) before the echo arrives.
 *
 * The numbers mean something only behind an edge: `stack.mjs up --web
 * --latency 60` gives every leg the dev deployment's round trip. On a bare
 * stack the echo is a few milliseconds and the test proves only that the
 * prediction is drawn and taken away again. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ baseURL: WEB_URL });

/** Uppercase, so nothing else the shell prints is taken for the key's echo. */
const KEYS = 'QWZKJXVB';
/** Longer than any echo, so each key is timed alone. */
const GAP_MS = 400;

interface Timing {
  key: string;
  echoMs: number | null;
  drawnMs: number | null;
}

test('a key is drawn before the relay brings its echo back', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleettyping');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'typing');
  const sessionId = await createSession(api, box.id, installationId);

  // Everything is timed on the page's clock: when a key went down, when a
  // binary frame carrying it arrived, and when a predicted glyph for it was
  // added over the grid.
  await page.addInitScript(() => {
    const marks = { keys: [] as [string, number][], frames: [] as [string, number][] };
    (window as unknown as { __typing: typeof marks }).__typing = marks;
    const decoder = new TextDecoder();
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (!String(url).includes('/relay/attach')) return;
        this.addEventListener('message', (event) => {
          if (typeof event.data === 'string') return;
          const at = performance.now();
          const read = (buffer: ArrayBuffer) =>
            marks.frames.push([decoder.decode(buffer, { stream: true }), at]);
          if (event.data instanceof ArrayBuffer) read(event.data);
          else void (event.data as Blob).arrayBuffer().then(read);
        });
      }
    };
    document.addEventListener(
      'keydown',
      (event) => marks.keys.push([event.key, performance.now()]),
      true,
    );
  });

  let screen = '';
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') {
        screen = (screen + frame.payload.toString()).slice(-100_000);
      }
    });
  });

  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => screen.includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);
  await expect(page.getByText('Live', { exact: true })).toBeVisible();
  await page.locator('.xterm').first().click();

  // A glyph drawn over the grid, timed as it is added.
  await page.evaluate(() => {
    const drawn: [string, number][] = [];
    (window as unknown as { __drawn: typeof drawn }).__drawn = drawn;
    new MutationObserver((records) => {
      const at = performance.now();
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          const text = node.textContent ?? '';
          if (node instanceof HTMLSpanElement && text.length === 1) drawn.push([text, at]);
        }
      }
    }).observe(document.querySelector('[data-local-echo]') as Element, {
      childList: true,
      subtree: true,
    });
  });

  // The first key of a line waits on its echo by design: nothing is drawn
  // until the program has shown it echoes (a password prompt never does).
  await page.keyboard.type('#');
  await expect.poll(() => screen.includes('#')).toBe(true);
  for (const key of KEYS) {
    await page.keyboard.type(key);
    await page.waitForTimeout(GAP_MS);
  }
  await expect.poll(() => screen.includes(KEYS)).toBe(true);

  const timings = await page.evaluate((keys) => {
    const w = window as unknown as {
      __typing: { keys: [string, number][]; frames: [string, number][] };
      __drawn: [string, number][];
    };
    return [...keys].map((key) => {
      const down = w.__typing.keys.find(([k]) => k === key)?.[1] ?? 0;
      const echo = w.__typing.frames.find(([text, at]) => at >= down && text.includes(key))?.[1];
      const drawn = w.__drawn.find(([text, at]) => at >= down && text === key)?.[1];
      return {
        key,
        echoMs: echo === undefined ? null : echo - down,
        drawnMs: drawn === undefined ? null : drawn - down,
      };
    });
  }, KEYS);

  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;
  const echo = median(timings.flatMap((t: Timing) => (t.echoMs === null ? [] : [t.echoMs])));
  const drawn = median(timings.flatMap((t: Timing) => (t.drawnMs === null ? [] : [t.drawnMs])));
  const report = `echo median ${echo.toFixed(0)} ms, drawn median ${drawn.toFixed(0)} ms`;
  console.log(`typing: ${report}\n${JSON.stringify(timings)}`);
  test.info().annotations.push({ type: 'typing', description: report });

  // Every key after the first was predicted, and drawn within a frame or two
  // of going down — whatever the relay costs.
  expect(timings.every((t: Timing) => t.drawnMs !== null)).toBe(true);
  expect(drawn).toBeLessThan(50);
  // And the shell's own echo replaced every prediction.
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[data-local-echo] span').length))
    .toBe(0);
});
