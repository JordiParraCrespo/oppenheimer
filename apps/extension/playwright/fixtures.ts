import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';
import type { CloudSessionRecord } from '../src/sessions/session';

const DIST = path.resolve(import.meta.dirname, '../dist');

/** A fake claude.ai: its sessions list answers with whatever `sessions` holds. */
export interface FakeClaude {
  sessions: CloudSessionRecord[];
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
    await use({ sessions: [], requests: [] });
  },

  context: async ({ claude }, use) => {
    const context = await chromium.launchPersistentContext(
      mkdtempSync(path.join(tmpdir(), 'ext-')),
      {
        channel: 'chromium',
        args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
      },
    );
    await context.route('https://claude.ai/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/code/sessions') {
        claude.requests.push({ url: url.href, headers: route.request().headers() });
        return route.fulfill({ json: { data: claude.sessions, next_cursor: null } });
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
