import { createHash, generateKeyPairSync, randomInt } from 'node:crypto';
import { type APIRequestContext, type APIResponse, expect } from '@playwright/test';
import { newContext } from './auth';
import githubApp from './github-app.json' with { type: 'json' };
import { claimInstallation } from './github-stub';

/**
 * What a New session spec needs standing behind it: a paired host and a
 * connected GitHub installation.
 *
 * Both are set up through the real API rather than by writing rows: a seeded
 * row proves nothing about pairing or about the App. The GitHub half is
 * `support/github-stub.ts`, which the API reaches through `GITHUB_APP_API_URL`.
 */
export const GITHUB_STUB_URL = process.env.GITHUB_STUB_URL ?? 'http://127.0.0.1:4319';

export const STUB_REPOSITORIES = {
  mobile: { githubRepoId: 821374923, name: 'xrp-mobile', defaultBranch: 'main' },
  web: { githubRepoId: 821374924, name: 'xrp-web', defaultBranch: 'trunk' },
} as const;

/**
 * Where the API sends a reader to install the stub App: built from the slug
 * `stub-env.ts` gives it, the way `GET /health/capabilities` builds it.
 */
export const STUB_INSTALL_URL = `https://github.com/apps/${githubApp.slug}/installations/new`;

/** A branch of `xrp-mobile` that is not its default, so picking one is visible. */
export const STUB_BRANCH = 'fix/wallet-empty-state';

/**
 * Start a GitHub App install as the caller: the single-use state
 * `POST /installations` requires, minted for this person in this workspace.
 * A browser gets it back from GitHub on the redirect; a test takes it straight.
 */
export async function mintInstallState(api: APIRequestContext): Promise<string> {
  const response = await api.post('/api/v1/installations/install-state', {
    failOnStatusCode: false,
  });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { state: string }).state;
}

/**
 * Connect a GitHub installation to the caller's workspace.
 *
 * Each call claims a **fresh** id from the stub (`claimInstallation` says why)
 * and mints a fresh state first, the way the console does on Connect: a state
 * is spent by one attempt.
 */
export async function connectInstallation(api: APIRequestContext): Promise<string> {
  // Random over 2^40, not derived from the pid: parallel workers and earlier
  // runs against the same database must never draw an id already claimed.
  const githubInstallationId = randomInt(1_000_000, 2 ** 40);
  await claimInstallation(GITHUB_STUB_URL, githubInstallationId);

  const response = await withoutTripping(async () =>
    api.post('/api/v1/installations', {
      data: { githubInstallationId, code: 'stub-oauth-code', state: await mintInstallState(api) },
      failOnStatusCode: false,
    }),
  );
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/** A machine's keypair, encoded the way the runner encodes it. */
function hostKey() {
  const { publicKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return {
    base64: raw.toString('base64'),
    fingerprint: createHash('sha256').update(raw).digest('hex'),
  };
}

/**
 * What a runner from **before Grok** reports: it probes the command of every
 * agent it can start, installed or not (`ProbedTools`), and Grok is not one of
 * them. The control plane reads that list as what the runner knows, so Claude
 * Code starts here and a Grok session is refused at create (`SESSIONS_011`) —
 * which `sessions.spec.ts` checks.
 */
const FACTS = {
  platform: 'linux',
  arch: 'amd64',
  hostname: 'e2e-box.local',
  user: 'runner',
  home: '/home/runner',
  root: false,
  tools: [
    { name: 'git', path: '/usr/bin/git', version: '2.51.0', required: true },
    { name: 'tmux', path: '/usr/bin/tmux', version: '3.5a', required: true },
    { name: 'claude', path: '/usr/local/bin/claude', version: '2.1.278', required: false },
    { name: 'codex', required: false },
    { name: 'opencode', required: false },
  ],
  workspacePath: '/home/runner/oppenheimer-ai',
  diskFreeBytes: 120_000_000_000,
  runnerVersion: '0.1.0',
};

/**
 * Pairing is rate-limited at both ends, and both buckets are **this machine's
 * address**: registration is anonymous, and minting is authenticated but the
 * global throttler resolves a cookie session to its IP (the tracker says so —
 * `request.user` is populated only when the guard runs at route level). Every
 * worker of this suite shares one address, so a suite that pairs several
 * machines trips five registrations or ten mints a minute.
 *
 * Those limits are the product's and are not a test's to weaken — one bounds
 * guessing at a route whose whole job is redeeming a secret (F5). So the tests
 * wait instead, and a test that pairs is `test.slow()` at its call site.
 */
const THROTTLE_RETRY_MS = 5_000;
const THROTTLE_WINDOW_MS = 65_000;

async function withoutTripping(call: () => Promise<APIResponse>): Promise<APIResponse> {
  const deadline = Date.now() + THROTTLE_WINDOW_MS;
  let response = await call();
  while (response.status() === 429 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_RETRY_MS));
    response = await call();
  }
  return response;
}

/** `POST /hosts/register`, retried while the throttle is closed. */
export function registerHost(
  anonymous: APIRequestContext,
  body: Record<string, unknown>,
): Promise<APIResponse> {
  return withoutTripping(() =>
    anonymous.post('/api/v1/hosts/register', { data: body, failOnStatusCode: false }),
  );
}

/**
 * Try to spend a registration token and answer only the status, for a spec
 * that expects a refusal — a token the dialog revoked when it minted the next.
 */
export async function redemptionStatus(secret: string, name: string): Promise<number> {
  const anonymous = await newContext();
  const registered = await registerHost(anonymous, {
    token: secret,
    name,
    publicKey: hostKey().base64,
    facts: FACTS,
  });
  const status = registered.status();
  await anonymous.dispose();
  return status;
}

/**
 * Spend a registration token the way a runner does — anonymously, with its own
 * keypair.
 *
 * Exported apart from {@link pairHost} because a token is not always minted
 * through the API: the Add host dialog mints its own and prints it inside the
 * install command, and the spec that drives it redeems *that* secret, which is
 * the only way the dialog's status line can be shown to be watching the token
 * it minted rather than the host list.
 */
export async function redeemPairingToken(secret: string, name: string): Promise<string> {
  const anonymous = await newContext();
  const registered = await registerHost(anonymous, {
    token: secret,
    name,
    publicKey: hostKey().base64,
    facts: FACTS,
  });
  expect(registered.status(), await registered.text()).toBe(201);
  const hostId = ((await registered.json()) as { hostId: string }).hostId;
  await anonymous.dispose();
  return hostId;
}

/**
 * The secret an install command carries, which is the only place it is shown.
 * It rides in the installer's environment (`OPPENHEIMER_REGISTRATION_TOKEN=…`),
 * never as an argument.
 */
export function tokenFrom(installCommand: string): string {
  const secret = /OPPENHEIMER_REGISTRATION_TOKEN=(\S+)/.exec(installCommand)?.[1];
  expect(secret, 'the install command carries the pairing token').toBeTruthy();
  return secret as string;
}

/**
 * Mint and redeem a pairing token. Both routes are throttled by address (see
 * `THROTTLE_WINDOW_MS`), so a test that calls this is `test.slow()`.
 */
export async function pairHost(api: APIRequestContext, name: string): Promise<string> {
  return redeemPairingToken(await mintPairingToken(api, name), name);
}

/**
 * Mint the registration token an install command carries, without spending it —
 * for a real runner to redeem (`support/fleet.ts`).
 */
export async function mintPairingToken(api: APIRequestContext, name: string): Promise<string> {
  const minted = await withoutTripping(() =>
    api.post('/api/v1/hosts/pairing', { data: { name }, failOnStatusCode: false }),
  );
  expect(minted.status(), await minted.text()).toBe(201);
  return tokenFrom(((await minted.json()) as { installCommand: string }).installCommand);
}

let projectCounter = 0;

/**
 * `POST /projects` holding the stub's `xrp-mobile` as its one default repository,
 * for a spec about projects or moving between them. A session that names none is
 * listed in the workspace's Unassigned project
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 */
export async function createProject(
  api: APIRequestContext,
  installationId: string,
  name = `E2E project ${process.pid}-${++projectCounter}`,
): Promise<string> {
  const created = await api.post('/api/v1/projects', {
    data: {
      name,
      repositories: [
        {
          installationId,
          githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId,
          baseBranch: STUB_REPOSITORIES.mobile.defaultBranch,
          isDefault: true,
        },
      ],
    },
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

let sessionCounter = 0;

/** What the composer can add to a session besides its checkout. */
export interface SessionChoices {
  agent?: string;
  launch?: { model?: string; permission?: string; effort?: string };
  prompt?: string;
}

/**
 * `POST /sessions` on `hostId`, checking out the stub's `xrp-mobile`: the one
 * session factory every spec with a real runner shares. Claude Code with each
 * default unless `choices` says otherwise.
 */
export async function createSession(
  api: APIRequestContext,
  hostId: string,
  installationId: string,
  { agent = 'claude-code', ...choices }: SessionChoices = {},
): Promise<string> {
  sessionCounter += 1;
  const created = await api.post('/api/v1/sessions', {
    headers: { 'Idempotency-Key': `e2e-${hostId}-${process.pid}-${sessionCounter}-${Date.now()}` },
    data: {
      hostId,
      agent,
      ...choices,
      checkouts: [{ installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId }],
    },
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

/**
 * A session's stored lifecycle, as `GET /sessions/{id}` spells it: the
 * `SESSION_STATES` of `@oppenheimer/shared`, which this package does not
 * depend on.
 */
export type SessionLifecycle = 'starting' | 'open' | 'failed' | 'resolved';

export interface SessionRow {
  id: string;
  name: string;
  lifecycle: SessionLifecycle;
  stoppedAt: string | null;
  checkouts: { branch: string; directoryName: string }[];
}

export async function waitForLifecycle(
  api: APIRequestContext,
  sessionId: string,
  lifecycle: SessionLifecycle,
  timeout = 120_000,
): Promise<SessionRow> {
  let row: SessionRow | undefined;
  await expect
    .poll(
      async () => {
        row = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as SessionRow;
        return row.lifecycle;
      },
      { timeout, intervals: [1_000, 2_000] },
    )
    .toBe(lifecycle);
  if (!row) throw new Error(`session ${sessionId} was never read`);
  return row;
}
