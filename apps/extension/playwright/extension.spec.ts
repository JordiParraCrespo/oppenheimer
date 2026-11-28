import type { Worker } from '@playwright/test';
import type { StoredState } from '../src/sessions/store';
import { blocked, completed, expect, failed, running, test } from './fixtures';

const stored = (worker: Worker) =>
  worker.evaluate(async () => ({
    ...((await chrome.storage.local.get(null)) as Partial<StoredState>),
    badge: await chrome.action.getBadgeText({}),
    shown: (globalThis as unknown as { shown: unknown[] }).shown,
  }));

test('learns the sessions endpoint from claude.ai/code and counts what needs you', async ({
  context,
  claude,
  worker,
}) => {
  claude.sessions = [
    running('s1', 'Port the extension'),
    blocked('s2', 'Fix login'),
    completed('s3', 'Docs'),
  ];

  const page = await context.newPage();
  await page.goto('https://claude.ai/code');

  await expect
    .poll(async () => (await stored(worker)).endpoint)
    .toMatchObject({
      url: 'https://claude.ai/v1/code/sessions?limit=20',
      from: 'page',
      headers: { 'anthropic-beta': 'ccr-byoc-2025-07-29', 'x-organization-uuid': 'org-1' },
    });
  const state = await stored(worker);
  expect(state.badge).toBe('1');
  // What was already waiting at install is not news.
  expect(state.shown).toEqual([]);
});

test('polls on its own, and notifies a session that comes to need you', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  claude.sessions = [running('s1', 'Port the extension'), running('s2', 'Fix login')];
  const page = await context.newPage();
  await page.goto('https://claude.ai/code');
  // Learned from the page, not only seeded: the extension's own probe at
  // install can seed first, and closing the page then can lose its request,
  // whose headers the poll below must carry.
  await expect.poll(async () => (await stored(worker)).endpoint?.from).toBe('page');
  await expect.poll(async () => (await stored(worker)).seeded).toBe(true);
  await page.close();

  claude.sessions = [blocked('s1', 'Port the extension'), failed('s2', 'Fix login')];
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();

  const needsYou = popup.getByRole('region', { name: 'Needs you' });
  await expect(needsYou).toContainText('Port the extension');
  await expect(needsYou).toContainText('Fix login');
  const state = await stored(worker);
  expect(state.badge).toBe('2');
  expect(state.shown).toEqual([
    { id: 'session:s1', title: 'Needs you: Port the extension', message: 'Wants to use Bash' },
    { id: 'session:s2', title: 'Failed: Fix login', message: 'tests are red' },
  ]);
  // The poll asks with the headers claude.ai's own request carried.
  expect(claude.requests.at(-1)?.headers).toMatchObject({
    'anthropic-beta': 'ccr-byoc-2025-07-29',
    'x-organization-uuid': 'org-1',
  });
});

test('the popup is clear when nothing needs you, and shows done behind the switch', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  claude.sessions = [running('s1', 'Port the extension'), completed('s2', 'Write docs')];
  const page = await context.newPage();
  await page.goto('https://claude.ai/code');
  await expect.poll(async () => (await stored(worker)).seeded).toBe(true);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText("You're clear")).toBeVisible();
  await expect(popup.getByText('1 session is still running.', { exact: false })).toBeVisible();
  await expect(popup.getByText('Write docs')).toBeHidden();

  await popup.getByRole('switch', { name: 'Show done' }).click();
  await expect(popup.getByText('Write docs')).toBeVisible();
});

test('a row copies the command that brings the session into a terminal', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  claude.sessions = [blocked('session_01abc', 'Fix login')];
  const page = await context.newPage();
  await page.goto('https://claude.ai/code');
  await expect.poll(async () => (await stored(worker)).seeded).toBe(true);

  const popup = await context.newPage();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByText('Fix login').hover();
  await popup.getByRole('button', { name: 'Copy command' }).click();

  await expect(popup.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe(
    'claude --teleport session_01abc',
  );
});

test('tells you to sign in when claude.ai refuses', async ({ context, worker, extensionId }) => {
  await context.route('https://claude.ai/v1/**', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();

  await expect(popup.getByText('Sign in to claude.ai in this Chrome')).toBeVisible();
  expect((await stored(worker)).badge).toBe('');
});

test('reports what it tracks to the Oppenheimer it is connected to', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST',
  };
  const reports: Array<{ authorization?: string; body: unknown }> = [];
  await context.route('http://localhost:3001/**', (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    reports.push({ authorization: request.headers().authorization, body: request.postDataJSON() });
    return route.fulfill({ headers: cors, json: { matched: 1 } });
  });
  await worker.evaluate(() =>
    chrome.storage.local.set({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_test' },
    }),
  );

  claude.sessions = [
    blocked('session_01FixLogin00', 'Fix login'),
    running('session_01PortExt000', 'Port the extension'),
  ];
  const page = await context.newPage();
  await page.goto('https://claude.ai/code');

  // It reports after every check, and a check that ran before the page was
  // read tracked nothing yet: wait for the report that carries the sessions.
  await expect
    .poll(() => reports.at(-1))
    .toEqual({
      authorization: 'Bearer oppenheimer_pat_test',
      body: {
        sessions: expect.arrayContaining([
          { cloudSessionId: 'session_01FixLogin00', state: 'needs-input' },
          { cloudSessionId: 'session_01PortExt000', state: 'running' },
        ]),
      },
    });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('Reporting to localhost:3001 · 1 launched there')).toBeVisible();
});

test('reads every page of the list, and keeps what a failed page did not show', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  claude.sessions = [running('s1', 'Port the extension')];
  claude.firstCursor = 'page-2';
  claude.pages = { 'page-2': { data: [blocked('s2', 'An older session')], next_cursor: null } };

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect
    .poll(async () => Object.keys((await stored(worker)).sessions ?? {}).sort())
    .toEqual(['s1', 's2']);
  expect((await stored(worker)).badge).toBe('1');

  // The second page fails: the session only it shows is not taken for archived.
  claude.pages = {};
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect(popup.getByRole('button', { name: 'Check now' })).toBeEnabled();
  expect(Object.keys((await stored(worker)).sessions ?? {}).sort()).toEqual(['s1', 's2']);
});

test.describe('in Spanish', () => {
  test.use({ locale: 'es-ES' });

  test('speaks the reader’s language', async ({ context, claude, worker, extensionId }) => {
    claude.sessions = [blocked('s1', 'Arreglar el login')];
    const page = await context.newPage();
    await page.goto('https://claude.ai/code');
    await expect.poll(async () => (await stored(worker)).seeded).toBe(true);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole('heading', { name: 'Sesiones de Claude Code' })).toBeVisible();
    await expect(popup.getByRole('region', { name: 'Te necesitan' })).toContainText(
      'Arreglar el login',
    );
    await expect(popup.getByRole('button', { name: 'Comprobar ahora' })).toBeVisible();
  });
});

test('tells you when a session on your own hosts comes to wait on you', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST',
  };
  const row = (state: string, observedSince: string | null) => ({
    id: 'run-1',
    name: 'Codex on my laptop',
    state,
    lifecycle: 'open',
    observedSince,
    stateSeq: 4,
    cloudSessionId: null,
    decision: null,
    notice: null,
  });
  let rows = [row('working', null)];
  const reads: Array<string | undefined> = [];
  await context.route('http://localhost:3001/**', (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/v1/sessions') {
      reads.push(request.headers().authorization);
      return route.fulfill({ headers: cors, json: { data: rows, meta: { nextCursor: null } } });
    }
    return route.fulfill({ headers: cors, json: { matched: 0 } });
  });
  await worker.evaluate(() =>
    chrome.storage.local.set({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_test' },
    }),
  );
  claude.sessions = [running('session_01PortExt000', 'Port the extension')];

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();
  // The first look only remembers: nothing was waiting, and nothing is told.
  await expect.poll(async () => (await stored(worker)).runnerSeen).toEqual([]);
  expect(reads.at(-1)).toBe('Bearer oppenheimer_pat_test');

  rows = [row('waiting-on-you', '2026-11-24T09:00:00.000Z')];
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect
    .poll(async () => (await stored(worker)).shown)
    .toContainEqual({
      id: 'runner:run-1|session:run-1:2026-11-24T09:00:00.000Z',
      title: 'Codex on my laptop is waiting on you',
      message: 'Open it in Oppenheimer',
    });
  expect((await stored(worker)).badge).toBe('1');

  // Still waiting on the next check: told once, still counted.
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect.poll(() => reads.length).toBeGreaterThanOrEqual(3);
  const state = await stored(worker);
  expect(
    state.shown?.filter((shown) => (shown as { id: string }).id.startsWith('runner:')),
  ).toHaveLength(1);
  expect(state.badge).toBe('1');
});

test('a failed read of your hosts says so and leaves the badge, and disconnecting clears it', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST',
  };
  let down = false;
  const waiting = {
    id: 'run-1',
    name: 'Codex on my laptop',
    state: 'waiting-on-you',
    lifecycle: 'open',
    observedSince: '2026-11-24T09:00:00.000Z',
    stateSeq: 4,
    cloudSessionId: null,
    decision: null,
    notice: null,
  };
  await context.route('http://localhost:3001/**', (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.method() === 'GET') {
      if (down)
        return route.fulfill({ status: 401, headers: cors, json: { title: 'Unauthorized' } });
      return route.fulfill({
        headers: cors,
        json: { data: [waiting], meta: { nextCursor: null } },
      });
    }
    return route.fulfill({ headers: cors, json: { matched: 0 } });
  });
  await worker.evaluate(() =>
    chrome.storage.local.set({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_test' },
    }),
  );
  claude.sessions = [running('session_01PortExt000', 'Port the extension')];

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect.poll(async () => (await stored(worker)).badge).toBe('1');

  // The token is revoked: the wait is no longer counted as if known, and the popup says why.
  down = true;
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect(
    popup.getByText("Can't read the sessions on your hosts: 401 Unauthorized"),
  ).toBeVisible();
  expect((await stored(worker)).badge).toBe('');

  // Back up: counted again, the line gone, and the wait not told a second time.
  down = false;
  await popup.getByRole('button', { name: 'Check now' }).click();
  await expect.poll(async () => (await stored(worker)).badge).toBe('1');
  await expect(popup.getByText("Can't read the sessions on your hosts")).toHaveCount(0);

  // Disconnecting takes them off the badge at once, with claude.ai unreachable too.
  await context.route('https://claude.ai/v1/**', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await popup.getByRole('button', { name: 'Disconnect' }).click();
  await expect.poll(async () => (await stored(worker)).badge).toBe('');
});

test('carries a session’s chat to Oppenheimer and posts a reply typed there on claude.ai', async ({
  context,
  claude,
  worker,
  extensionId,
}) => {
  const ID = 'session_01ChatBridge00';
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST',
  };
  const forwarded: Array<{ cloudSessionId: string; title?: string; events: { id: string }[] }> = [];
  let claimable = [
    {
      id: '0b8f0c2e-6b8c-4f1e-9c9e-2f0e6b0e8a11',
      cloudSessionId: ID,
      text: 'Also the signup page',
    },
  ];
  await context.route('http://localhost:3001/**', (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/cloud-events')) {
      forwarded.push(request.postDataJSON());
      return route.fulfill({ headers: cors, json: { sessionId: 'console-1', accepted: 2 } });
    }
    if (path.endsWith('/cloud-replies/claim')) {
      const replies = claimable;
      claimable = [];
      return route.fulfill({ headers: cors, json: { replies } });
    }
    return route.fulfill({ headers: cors, json: { matched: 0 } });
  });
  const posted: unknown[] = [];
  await context.route('https://claude.ai/v1/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `/v1/code/sessions/${ID}/teleport-events`) {
      return route.fulfill({
        json: {
          data: [
            {
              payload: {
                type: 'user',
                uuid: 'u1',
                message: { role: 'user', content: 'Fix login' },
              },
            },
            {
              payload: {
                type: 'assistant',
                uuid: 'a1',
                message: { role: 'assistant', content: [{ type: 'text', text: 'On it' }] },
              },
            },
          ],
        },
      });
    }
    if (path === `/v1/sessions/${ID}/events` && request.method() === 'POST') {
      posted.push(request.postDataJSON());
      return route.fulfill({ json: {} });
    }
    return route.fallback();
  });
  await worker.evaluate(() =>
    chrome.storage.local.set({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_test' },
    }),
  );
  claude.sessions = [running(ID, 'Fix login')];
  const page = await context.newPage();
  await page.goto('https://claude.ai/code');
  await expect.poll(async () => (await stored(worker)).seeded).toBe(true);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();

  // Breaks if the reply typed in the console is not posted as the person's
  // message, or the conversation (the person's turn included) never leaves.
  await expect
    .poll(() => posted)
    .toEqual([
      {
        events: [
          {
            type: 'user',
            uuid: '0b8f0c2e-6b8c-4f1e-9c9e-2f0e6b0e8a11',
            parent_tool_use_id: null,
            message: { role: 'user', content: 'Also the signup page' },
          },
        ],
      },
    ]);
  await expect.poll(() => forwarded.at(0)?.events.map((event) => event.id)).toEqual(['u1', 'a1']);
  expect(forwarded[0]).toMatchObject({ cloudSessionId: ID, title: 'Fix login' });
});

test('says in the popup when the token cannot carry the chat', async ({
  context,
  worker,
  extensionId,
}) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST',
  };
  await context.route('http://localhost:3001/**', (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (new URL(request.url()).pathname.endsWith('/cloud-replies/claim')) {
      // A token made before the chat needed `cloud-chat:write`.
      return route.fulfill({
        status: 403,
        headers: cors,
        json: { title: 'The credential lacks a required scope', code: 'TOKEN_005' },
      });
    }
    return route.fulfill({ headers: cors, json: { matched: 0 } });
  });
  await worker.evaluate(() =>
    chrome.storage.local.set({
      oppenheimer: { apiUrl: 'http://localhost:3001', token: 'oppenheimer_pat_test' },
    }),
  );
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Check now' }).click();
  // Breaks if the popup reads as a healthy connection while no chat goes and
  // no reply is posted.
  await expect(
    popup.getByText('The chat needs a token with sessions:write and cloud-chat:write'),
  ).toBeVisible({ timeout: 15_000 });
});
