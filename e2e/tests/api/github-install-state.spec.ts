import { randomInt } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';
import { claimInstallation } from '../../support/github-stub';
import { GITHUB_STUB_URL, mintInstallState, STUB_INSTALL_URL } from '../../support/sessions';

/**
 * The GitHub App install callback is bound to the person who started it.
 *
 * The OAuth `code` on GitHub's redirect proves which GitHub account can see an
 * installation, not which console user's browser posts it — so a callback URL
 * someone stopped halfway through their own install used to connect their
 * installation to whoever opened it. `POST /installations` now requires a
 * state the API minted for this caller in this workspace, and spends it.
 */

/** A fresh installation the stub lists for the code, so only the state decides. */
async function freshInstallation(): Promise<number> {
  return claimInstallation(GITHUB_STUB_URL, randomInt(1_000_000, 2 ** 40));
}

test.describe('GitHub install state', () => {
  test('a started install carries a single-use state on the App URL', async () => {
    const { api } = await signedUpContext('installstart');

    const response = await api.post('/api/v1/installations/install-state');
    expect(response.status(), await response.text()).toBe(201);
    const body = (await response.json()) as { url: string; state: string; expiresAt: string };

    const url = new URL(body.url);
    expect(`${url.origin}${url.pathname}`).toBe(STUB_INSTALL_URL);
    expect(url.searchParams.get('state')).toBe(body.state);
    expect(body.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    await api.dispose();
  });

  test('a connect without a state fails validation', async () => {
    const { api } = await signedUpContext('installnostate');
    const githubInstallationId = await freshInstallation();

    const response = await api.post('/api/v1/installations', {
      data: { githubInstallationId, code: 'stub-oauth-code' },
      failOnStatusCode: false,
    });
    await expectProblemDocument(response, { status: 400 });

    await api.dispose();
  });

  test('a state someone else minted is refused', async () => {
    const mallory = await signedUpContext('installmallory');
    const victor = await signedUpContext('installvictor');
    const githubInstallationId = await freshInstallation();
    const state = await mintInstallState(mallory.api);

    const response = await victor.api.post('/api/v1/installations', {
      data: { githubInstallationId, code: 'stub-oauth-code', state },
      failOnStatusCode: false,
    });
    await expectProblemDocument(response, { status: 400, code: 'GITHUB_011' });

    const listed = await victor.api.get('/api/v1/installations');
    expect((await listed.json()) as unknown[]).toHaveLength(0);

    await mallory.api.dispose();
    await victor.api.dispose();
  });

  test('a state connects once, and a replay of it is refused', async () => {
    const { api } = await signedUpContext('installreplay');
    const githubInstallationId = await freshInstallation();
    const state = await mintInstallState(api);

    const first = await api.post('/api/v1/installations', {
      data: { githubInstallationId, code: 'stub-oauth-code', state },
      failOnStatusCode: false,
    });
    expect(first.status(), await first.text()).toBe(201);
    expect(((await first.json()) as { githubInstallationId: number }).githubInstallationId).toBe(
      githubInstallationId,
    );

    const replay = await api.post('/api/v1/installations', {
      data: { githubInstallationId, code: 'stub-oauth-code', state },
      failOnStatusCode: false,
    });
    await expectProblemDocument(replay, { status: 400, code: 'GITHUB_011' });

    await api.dispose();
  });
});
