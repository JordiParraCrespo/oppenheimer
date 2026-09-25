import { createHash, generateKeyPairSync } from 'node:crypto';
import { type APIRequestContext, type APIResponse, expect } from '@playwright/test';
import { newContext } from './auth';
import { claimInstallation } from './github-stub';

/**
 * What a New session spec needs standing behind it: a paired host and a
 * connected GitHub installation.
 *
 * Both are set up through the real API rather than by writing rows — the point
 * of an end-to-end run is that the path a person takes is the path under test,
 * and a seeded row proves nothing about pairing or about the App.
 *
 * The GitHub half needs a stub (`support/github-stub.ts`), because repositories
 * and branches are answered live by GitHub and this deployment has no App. The
 * API is pointed at it with `GITHUB_APP_API_URL`; everything else in the run is
 * real.
 */
export const GITHUB_STUB_URL = process.env.GITHUB_STUB_URL ?? 'http://127.0.0.1:4319';

/** The repositories the stub serves, as the picker will show them. */
export const STUB_REPOSITORIES = {
  mobile: { githubRepoId: 821374923, name: 'xrp-mobile', defaultBranch: 'main' },
  web: { githubRepoId: 821374924, name: 'xrp-web', defaultBranch: 'trunk' },
} as const;

/** A branch of `xrp-mobile` that is not its default, so picking one is visible. */
export const STUB_BRANCH = 'fix/wallet-empty-state';

let installationCounter = 0;

/**
 * Connect a GitHub installation to the caller's workspace.
 *
 * Each call claims a **fresh** id from the stub: an installation belongs to one
 * workspace and a second claim is `GITHUB_003`, which is the product's rule and
 * not something a test should work around.
 */
export async function connectInstallation(api: APIRequestContext): Promise<string> {
  installationCounter += 1;
  const githubInstallationId = 100_000 + process.pid * 100 + installationCounter;
  await claimInstallation(GITHUB_STUB_URL, githubInstallationId);

  const response = await withoutTripping(() =>
    api.post('/api/v1/installations', {
      data: { githubInstallationId, code: 'stub-oauth-code' },
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

/**
 * Make a throttled call, waiting the limiter out rather than working around it.
 *
 * A 429 here is the product working. The only correct response from a test is
 * patience, so this retries until the window has rolled and returns whatever
 * the route says then.
 */
async function withoutTripping(call: () => Promise<APIResponse>): Promise<APIResponse> {
  const deadline = Date.now() + THROTTLE_WINDOW_MS;
  let response = await call();
  while (response.status() === 429 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_RETRY_MS));
    response = await call();
  }
  return response;
}

/**
 * `POST /hosts/register`, retried while the throttle is closed.
 *
 * Exported so every spec that redeems a token shares one answer to the limit
 * rather than four.
 */
export function registerHost(
  anonymous: APIRequestContext,
  body: Record<string, unknown>,
): Promise<APIResponse> {
  return withoutTripping(() =>
    anonymous.post('/api/v1/hosts/register', { data: body, failOnStatusCode: false }),
  );
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
 * Pair a machine: mint the token the install command carries, then redeem it
 * the way a runner does — anonymously, with its own keypair.
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

let sessionCounter = 0;

/**
 * `POST /sessions` on `hostId`, checking out the stub's `xrp-mobile`: the one
 * session factory every spec with a real runner shares.
 */
export async function createSession(
  api: APIRequestContext,
  hostId: string,
  installationId: string,
): Promise<string> {
  sessionCounter += 1;
  const created = await api.post('/api/v1/sessions', {
    headers: { 'Idempotency-Key': `e2e-${hostId}-${process.pid}-${sessionCounter}-${Date.now()}` },
    data: {
      hostId,
      agent: 'claude-code',
      checkouts: [{ installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId }],
    },
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}
