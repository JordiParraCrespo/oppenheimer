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
