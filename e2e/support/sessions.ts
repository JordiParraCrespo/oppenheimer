import { createHash, generateKeyPairSync } from 'node:crypto';
import { type APIRequestContext, expect } from '@playwright/test';
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
 * API is pointed at it with `GITHUB_API_URL`; everything else in the run is
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

  const response = await api.post('/api/v1/installations', {
    data: { githubInstallationId, code: 'stub-oauth-code' },
    failOnStatusCode: false,
  });
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
 * Pair a machine: mint the token the install command carries, then redeem it
 * the way a runner does — anonymously, with its own keypair.
 */
export async function pairHost(api: APIRequestContext, name: string): Promise<string> {
  const minted = await api.post('/api/v1/hosts/pairing', {
    data: { name },
    failOnStatusCode: false,
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const command = ((await minted.json()) as { installCommand: string }).installCommand;
  const secret = /--token (\S+)/.exec(command)?.[1];
  expect(secret, 'the install command carries the pairing token').toBeTruthy();

  const anonymous = await newContext();
  const registered = await anonymous.post('/api/v1/hosts/register', {
    data: { token: secret, name, publicKey: hostKey().base64, facts: FACTS },
    failOnStatusCode: false,
  });
  expect(registered.status(), await registered.text()).toBe(201);
  const hostId = ((await registered.json()) as { hostId: string }).hostId;
  await anonymous.dispose();
  return hostId;
}
