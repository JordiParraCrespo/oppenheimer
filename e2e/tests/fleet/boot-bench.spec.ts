import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { query } from '../../support/db';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, STUB_REPOSITORIES } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Boot benchmark: from the click on Send in New session to the agent's first
 * bytes on the console's terminal, measured in the browser, hop by hop, with
 * the runner's own stage timings (`session.step`) beside them.
 *
 * Opt-in (`BOOT_BENCH=1`), on the fleet's local hosts. Knobs:
 * - `BENCH_RUNS` sessions in a row on one host (the first is a cold clone);
 * - `BENCH_AGENT=claude` runs the real Claude Code instead of the shim;
 * - `BENCH_REMOTE=<url>` clones xrp-mobile from a real remote, such as
 *   `https://github.com/microsoft/vscode.git`, instead of the local git server;
 *   behind a TLS-inspecting proxy, `GIT_SSL_CAINFO` must name a CA file the
 *   host's account can read, since the runner inherits it;
 * - `BENCH_TABS=<n>` keeps n tabs on the session while it starts;
 * - `BENCH_OUT` appends one JSON line per session, `BENCH_SHOTS` a screenshot
 *   and the session's requests.
 *
 * The findings it produced are `product/14-session-boot-time.md`.
 */
test.skip(process.env.BOOT_BENCH !== '1', 'the boot benchmark is opt-in (BOOT_BENCH=1)');
test.describe.configure({ timeout: 900_000 });
test.use({ baseURL: WEB_URL });

const RUNS = Number(process.env.BENCH_RUNS ?? 4);
const AGENT = process.env.BENCH_AGENT ?? 'shim';
const QUIET_MS = 1_500;

test('boot: Send → first agent bytes on the console', async ({ page, context }) => {
  const { api, user } = await signedUpContext('bootbench');
  await connectInstallation(api);

  const [box] = await pairedHosts(api, 1, 'bench');
  if (AGENT === 'claude') {
    box.host.exec('ln -sf /opt/node22/bin/claude "$HOME/bin/claude"');
  }

  if (process.env.BENCH_REMOTE) {
    // The stub's repository, cloned from a real remote instead of the local
    // git server: the more specific insteadOf wins over the fleet's own.
    box.host.exec(
      `git config --global url.${process.env.BENCH_REMOTE}.insteadOf https://github.com/acme-labs/xrp-mobile.git`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, user);

  const results: Record<string, unknown>[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    let t0 = 0;
    const at = () => Date.now() - t0;
    const marks: Record<string, number> = {};
    const mark = (name: string) => {
      if (t0 && marks[name] === undefined) marks[name] = at();
    };
    let lastFrame = 0;
    let bytes = 0;
    let screen = '';
    const urls: string[] = [];
    const polls: { t: number; lifecycle: string }[] = [];

    const onRequest = (request: import('@playwright/test').Request) => {
      const url = request.url();
      if (t0 && url.includes('session')) urls.push(`${at()} ${request.method()} ${url}`);
      if (request.method() === 'POST' && /\/sessions(\?|$)/.test(url)) mark('post_sent');
      if (url.includes('/attach-ticket')) mark('ticket_sent');
    };
    const onResponse = async (response: import('@playwright/test').Response) => {
      const url = response.url();
      const request = response.request();
      if (request.method() === 'POST' && /\/sessions(\?|$)/.test(url)) mark('post_201');
      if (url.includes('/attach-ticket')) mark('ticket_ok');
      if (request.method() === 'GET' && /\/sessions\/[0-9a-f-]{36}(\?|$)/.test(url)) {
        const t = at();
        try {
          const body = (await response.json()) as { lifecycle?: string };
          polls.push({ t, lifecycle: String(body.lifecycle) });
          if (body.lifecycle === 'open') mark('poll_open');
        } catch {}
      }
    };
    const onSocket = (socket: import('@playwright/test').WebSocket) => {
      if (!socket.url().includes('/relay/attach')) return;
      mark('ws_open');
      socket.on('framereceived', (frame) => {
        if (typeof frame.payload === 'string') return;
        mark('first_byte');
        bytes += frame.payload.length;
        lastFrame = at();
        const text = frame.payload.toString();
        screen = (screen + text).slice(-20_000);
        if (text.includes('CLAUDE-SHIM') || (AGENT === 'claude' && bytes > 400))
          mark('agent_drawn');
      });
    };
    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('websocket', onSocket);

    await page.goto('/sessions/new');
    await expect(page.getByRole('heading', { name: 'New session', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Host' }).click();
    await page.getByRole('option', { name: new RegExp(box.host.name) }).click();
    await page.getByRole('button', { name: 'Repositories' }).click();
    await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: /Describe a task/ }).fill(`bench run ${run}`);

    t0 = Date.now();
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    mark('navigated');
    const sessionId = page.url().split('/').pop() as string;
    // More tabs on the same session, as a person with the console open twice.
    const extra: import('@playwright/test').Page[] = [];
    for (let tab = 1; tab < Number(process.env.BENCH_TABS ?? 1); tab += 1) {
      const other = await context.newPage();
      await other.goto(`/sessions/${sessionId}`);
      extra.push(other);
    }
    await expect.poll(() => marks.agent_drawn !== undefined, { timeout: 180_000 }).toBe(true);
    // Settled: the screen has been quiet for QUIET_MS.
    await expect
      .poll(() => lastFrame > 0 && at() - lastFrame > QUIET_MS, { timeout: 60_000 })
      .toBe(true);
    marks.settled = lastFrame;
    for (const other of extra) await other.close();
    if (process.env.BENCH_SHOTS) {
      await page.screenshot({ path: join(process.env.BENCH_SHOTS, `${AGENT}-${run}.png`) });
      appendFileSync(
        join(process.env.BENCH_SHOTS, `${AGENT}-${run}.txt`),
        `${urls.join('\n')}\n---\n${screen}`,
      );
    }

    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('websocket', onSocket);

    const events = await query<{ kind: string; payload: Record<string, unknown>; at: string }>(
      `select kind, payload, "recordedAt" as at from work_session_event where "sessionId" = $1 order by seq`,
      [sessionId],
    );
    const steps: Record<string, number> = {};
    for (const event of events) {
      const t = new Date(event.at).getTime() - t0;
      if (event.kind === 'session.step' && event.payload.status === 'done') {
        steps[String(event.payload.step)] = Number(event.payload.durationMs);
      }
      if (event.kind === 'session.started') marks.server_started = t;
    }

    const row = {
      run,
      agent: AGENT,
      repo: process.env.BENCH_REMOTE ?? 'stub',
      marks,
      steps,
      polls,
      bytes,
    };
    results.push(row);
    if (process.env.BENCH_OUT) appendFileSync(process.env.BENCH_OUT, `${JSON.stringify(row)}\n`);
    console.log(JSON.stringify(row));
  }
  expect(results).toHaveLength(RUNS);
});
