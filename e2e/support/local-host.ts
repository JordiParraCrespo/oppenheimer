import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type APIRequestContext, expect } from '@playwright/test';
import { API_URL, WEB_URL } from '../playwright.config';
import { newContext, signIn } from './auth';
import { STUB_REPOSITORIES } from './sessions';

/**
 * The host `scripts/stack/stack.mjs host` paired: a real runner on this
 * machine, under its own account, owned by an account the script signed up.
 * The `local` project runs against it (`.agents/skills/local-stack`).
 */
export interface LocalHost {
  name: string;
  hostId: string;
  installationId: string;
  email: string;
  password: string;
  account: string;
}

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export function localHost(): LocalHost {
  const file = join(process.env.STACK_DIR ?? join(REPO_ROOT, '.stack'), 'host.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LocalHost;
  } catch {
    throw new Error(`no local host at ${file}: run \`node scripts/stack/stack.mjs host\` first`);
  }
}

/** A request context signed in as the host's owner. */
export async function ownerContext(host: LocalHost): Promise<APIRequestContext> {
  const api = await newContext();
  const response = await signIn(api, host.email, host.password);
  expect(response.status(), await response.text()).toBe(200);
  return api;
}

export async function createSession(api: APIRequestContext, host: LocalHost): Promise<string> {
  const created = await api.post('/api/v1/sessions', {
    headers: { 'Idempotency-Key': `local-${host.hostId}-${Date.now()}-${Math.random()}` },
    data: {
      hostId: host.hostId,
      agent: 'claude-code',
      checkouts: [
        {
          installationId: host.installationId,
          githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId,
        },
      ],
    },
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

/**
 * A terminal over the real attach socket that **credits** what it reads, as the
 * console does. The fleet's `attach` does not, which is right for what it
 * checks but stalls any pane past the 256 KB window — so a test that prints
 * more than that needs this one.
 */
export interface CreditingTerminal {
  send(text: string): void;
  waitFor(text: string, timeout?: number): Promise<void>;
  bytes(): number;
  closeCode(): number | null;
  close(): void;
}

export async function openTerminal(
  api: APIRequestContext,
  sessionId: string,
): Promise<CreditingTerminal> {
  const minted = await api.post(`/api/v1/sessions/${sessionId}/attach-ticket`, {
    data: { window: 0 },
  });
  const { ticket } = (await minted.json()) as { ticket: string };
  const socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/v1/relay/attach`, {
    protocols: [ticket],
    headers: { origin: WEB_URL },
  } as unknown as string[]);
  socket.binaryType = 'arraybuffer';
  // The tail only: a flood is tens of megabytes and nothing searches all of it.
  let tail = '';
  let bytes = 0;
  let attached = false;
  let closeCode: number | null = null;
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') {
      if ((JSON.parse(event.data) as { type: string }).type === 'attached') attached = true;
      return;
    }
    const chunk = Buffer.from(event.data as ArrayBuffer);
    bytes += chunk.byteLength;
    tail = (tail + chunk.toString()).slice(-200_000);
    socket.send(JSON.stringify({ type: 'credit', bytes: chunk.byteLength }));
  });
  socket.addEventListener('close', (event) => {
    closeCode = event.code;
  });
  await new Promise<void>((ok, refuse) => {
    socket.addEventListener('open', () => ok(), { once: true });
    socket.addEventListener('error', () => refuse(new Error('attach socket refused')), {
      once: true,
    });
  });
  socket.send(JSON.stringify({ type: 'resize', cols: 120, rows: 30 }));
  await expect.poll(() => attached, { message: 'attached', timeout: 30_000 }).toBe(true);
  return {
    send: (text) => socket.send(Buffer.from(text)),
    async waitFor(text, timeout = 30_000) {
      await expect
        .poll(() => tail.includes(text), {
          message: `"${text}" on screen`,
          timeout,
          intervals: [5],
        })
        .toBe(true);
    },
    bytes: () => bytes,
    closeCode: () => closeCode,
    close: () => socket.close(1000, 'done'),
  };
}
