import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { signedUpContext, type TestUser } from './auth';

/**
 * Helpers for the `web` project: the journeys every browser spec starts from.
 *
 * Registering provisions a personal workspace, but with an address nobody has
 * chosen yet — so a fresh account lands in first-run, at the step that names
 * it, rather than in the console. Most specs want a user who is already past
 * that. That is {@link provisionedUser}: sign-up and workspace creation
 * through the API, so the spec spends its time on the screen it is about
 * rather than on the screens before it.
 */

export const ORGANIZATION_NAME = 'E2E Workspace';

export async function registerThroughUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.fill('#firstName', user.firstName);
  await page.fill('#lastName', user.lastName);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

export async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Signs in through the real form and waits for the workspace shell. */
export async function signInAs(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await loginThroughUi(page, user.email, user.password);
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
}

/** `POST /v1/organizations` as the context's user; returns the new id. */
export async function createOrganization(
  api: APIRequestContext,
  name = ORGANIZATION_NAME,
): Promise<string> {
  const response = await api.post('/api/v1/organizations', { data: { name } });
  expect(response.status(), `creating the workspace "${name}" should succeed`).toBe(201);
  const body = (await response.json()) as { id: string };
  return body.id;
}

/** A fresh account that already owns a workspace, with a session cookie to match. */
export async function provisionedUser(prefix = 'user') {
  const { api, user, userId } = await signedUpContext(prefix);
  const organizationId = await createOrganization(api);
  return { api, user, userId, organizationId };
}

/**
 * Registers through the UI and walks first-run as far as Connect GitHub.
 *
 * Three specs want an account that has just claimed its address, and typing
 * the name into the same two fields three times hid where they actually
 * differ. It returns the claimed address so a caller can assert on it.
 *
 * It stops on step 3 on purpose: the claim is the moment the account becomes
 * finished, so everything the shown-once rule has to say starts here.
 */
export async function claimWorkspaceThroughUi(page: Page, label: string): Promise<string> {
  const name = `${label} ${Date.now().toString(36)}`;

  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });
  await page.getByLabel(/workspace name/i).fill(name);
  // The availability check is the API's — `POST /organizations/check-slug`,
  // not a timer — so Continue waits for its verdict, not for a delay.
  await expect(page.getByText(/is available/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/github/, { timeout: 30_000 });

  return name;
}

/** Invites `email` into the organization and returns the invitation id. */
export async function inviteByApi(
  api: APIRequestContext,
  organizationId: string,
  email: string,
  role: 'owner' | 'admin' | 'member' = 'member',
): Promise<string> {
  const response = await api.post(`/api/v1/organizations/${organizationId}/invitations`, {
    data: { email, role },
  });
  expect(response.status(), `inviting ${email} should succeed`).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/**
 * Reloads with the persisted query cache thrown away.
 *
 * TanStack Query's cache is persisted to local storage with a 60s stale window,
 * so a plain reload can re-render the values the page itself just wrote. Only a
 * reload with no cache to fall back on proves the value came from the API. The
 * session lives in an httpOnly cookie, so clearing storage does not sign the
 * reader out.
 */
export async function reloadFromServer(page: Page): Promise<void> {
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

/**
 * Opens a table row's action menu and clicks one item, surviving a re-render.
 *
 * The two-line version — click the trigger, click the item — is flaky, and not
 * for a reason a longer timeout fixes. The list refetches in the background (a
 * mutation settling, the query cache revalidating), the `<tr>` is replaced, and
 * the open menu goes with it. The only thing that recovers is opening the menu
 * again, which is what this does.
 */
export async function clickRowAction(
  page: Page,
  row: Locator,
  action: string | RegExp,
): Promise<void> {
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await row.getByRole('button', { name: 'Row actions' }).click();
      await page.getByRole('menuitem', { name: action }).click({ timeout: 10_000 });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
}
