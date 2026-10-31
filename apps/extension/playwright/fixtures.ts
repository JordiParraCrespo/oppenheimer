import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';
import type { CloudSessionRecord } from '../src/sessions/session';

const DIST = path.resolve(import.meta.dirname, '../dist');
/**
 * The Chromium to launch. An environment that ships one (a container image,
 * a cloud sandbox) says where with `PLAYWRIGHT_CHROMIUM_PATH`, as
 * `e2e/playwright.config.ts` reads it, or keeps it where `scripts/stack/screens.mjs`
 * looks; its build need not be the one this Playwright pins, which is the
 * one it would otherwise download. Neither, and Playwright resolves its own.
 */
const SHIPPED_CHROMIUM = '/opt/pw-browsers/chromium';
const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (existsSync(SHIPPED_CHROMIUM) ? SHIPPED_CHROMIUM : undefined);

/** A fake claude.ai: its sessions list answers with whatever `sessions` holds. */
export interface FakeClaude {
  sessions: CloudSessionRecord[];
  /**
   * Later pages of the list, by the cursor that names them; the first page
   * points at `firstCursor`. A cursor with no page answers 500.
   */
  pages: Record<string, { data: CloudSessionRecord[]; next_cursor: string | null }>;
  firstCursor: string | null;
  /** Every request to the list, with its headers. */
  requests: Array<{ url: string; headers: Record<string, string> }>;
}

export const test = base.extend<{
  context: BrowserContext;
  claude: FakeClaude;
  worker: Worker;
  extensionId: string;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this pattern; this one has none
  claude: async ({}, use) => {
    await use({ sessions: [], requests: [], pages: {}, firstCursor: null });
  },

  context: async ({ claude, locale }, use) => {
    const context = await chromium.launchPersistentContext(
      mkdtempSync(path.join(tmpdir(), 'ext-')),
      {
        channel: 'chromium',
        ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
        locale,
        args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
      },
    );
    // The extension probes claude.ai as soon as it is installed, before the
    // test has said what claude.ai holds. Its API waits for the test's first
    // page, by which time it has, so the first list the extension sees is the
    // test's (the baseline, not news) whichever request reaches it first.
    const opened = new Promise<void>((resolve) => context.once('page', () => resolve()));
    await context.route('https://claude.ai/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/v1/')) await opened;
      if (url.pathname === '/v1/code/sessions') {
        claude.requests.push({ url: url.href, headers: route.request().headers() });
        const cursor = url.searchParams.get('cursor');
        if (cursor) {
          const page = claude.pages[cursor];
          return page ? route.fulfill({ json: page }) : route.fulfill({ status: 500, json: {} });
        }
        return route.fulfill({ json: { data: claude.sessions, next_cursor: claude.firstCursor } });
      }
      if (url.pathname.startsWith('/v1/')) return route.fulfill({ status: 404, json: {} });
      // claude.ai/code: a page that loads the session list the way the app does.
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>Claude Code</title><script>
          fetch('/v1/code/sessions?limit=20', { headers: {
            'anthropic-beta': 'ccr-byoc-2025-07-29', 'x-organization-uuid': 'org-1' } });
        </script>`,
      });
    });
    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // Record notifications instead of showing them.
    await worker.evaluate(() => {
      const shown: Array<{ id: string; title: string; message: string }> = [];
      Object.assign(globalThis, { shown });
      chrome.notifications.create = ((
        id: string,
        options: chrome.notifications.NotificationOptions,
      ) => {
        shown.push({ id, title: options.title ?? '', message: options.message ?? '' });
        return Promise.resolve(id);
      }) as typeof chrome.notifications.create;
    });
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

export const at = '2026-10-27T10:00:00Z';
export const running = (id: string, title: string): CloudSessionRecord => ({
  id,
  title,
  status: 'active',
  worker_status: 'running',
  last_event_at: at,
});
export const blocked = (id: string, title: string): CloudSessionRecord => ({
  id,
  title,
  status: 'active',
  worker_status: 'requires_action',
  external_metadata: { pending_action: { tool_name: 'Bash' } },
  last_event_at: at,
});
export const failed = (id: string, title: string): CloudSessionRecord => ({
  id,
  title,
  status: 'active',
  worker_status: 'idle',
  status_bucket: 'failed',
  external_metadata: { post_turn_summary: { status_detail: 'tests are red' } },
  last_event_at: at,
});
export const completed = (id: string, title: string): CloudSessionRecord => ({
  id,
  title,
  status: 'active',
  worker_status: 'idle',
  status_bucket: 'completed',
  last_event_at: at,
});
