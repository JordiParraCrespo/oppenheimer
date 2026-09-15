import type { Page } from '@playwright/test';
import { scenario } from '../../src/harness.js';
import { looksLikeABreakage, SEEDED, TRANSIENT, visibleMessage } from './accounts.js';

/**
 * Every case asks the same two questions of whatever the screen ends up saying,
 * so they are asked in one place: was it legible, and was it a refusal rather
 * than a breakage.
 */
async function assertLegible(
  page: Page,
  qa: Parameters<Parameters<typeof scenario>[1]>[0]['qa'],
  label: string,
): Promise<string> {
  const text = await visibleMessage(page);
  const breakage = looksLikeABreakage(text);
  qa.check(`${label}: the screen says something legible`, !breakage, breakage ?? 'reads as prose');
  // A spinner still turning is the third way to fail a negative case: nothing
  // broke, nothing was said, and the reader is left waiting on an answer that
  // has already arrived.
  const spinning = await page
    .getByRole('status')
    .first()
    .isVisible()
    .catch(() => false);
  qa.check(`${label}: no spinner is left running`, !spinning);
  return text;
}

async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForTimeout(1500);
}

scenario('AUTH-04', async ({ page, qa }) => {
  // AUTH-04a — the right address, the wrong password.
  await submitLogin(page, SEEDED.superAdmin.email, 'definitely-not-the-password');
  const wrongPassword = await assertLegible(page, qa, 'AUTH-04a');
  qa.check(
    'AUTH-04a: the reader stays on the login screen',
    page.url().includes('/login'),
    page.url(),
  );
  await qa.shot(page, 'auth-04a-wrong-password', 'A correct address with the wrong password');

  // AUTH-04b — no such account. The two messages have to be the same, or the
  // pair of them is an account-enumeration oracle.
  await submitLogin(page, 'nobody.at.all@qa.oppenheimer.dev', 'definitely-not-the-password');
  const unknownAccount = await assertLegible(page, qa, 'AUTH-04b');
  qa.check(
    'AUTH-04b: an unknown address is refused the same way as a wrong password',
    unknownAccount === wrongPassword,
    `wrong password said ${JSON.stringify(wrongPassword.slice(0, 120))}; ` +
      `unknown account said ${JSON.stringify(unknownAccount.slice(0, 120))}`,
  );
  await qa.shot(page, 'auth-04b-unknown-account', 'An address with no account behind it');

  // AUTH-04c — validation belongs in the browser. A request at all is the
  // finding: it means the form is asking the server what a regex could answer.
  await page.goto('/login');
  let requested = false;
  await page.route('**/api/auth/sign-in/**', (route) => {
    requested = true;
    return route.continue();
  });
  await page.locator('#email').fill('not-an-address');
  await page.locator('#password').fill('whatever-123');
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForTimeout(1000);
  qa.check('AUTH-04c: a malformed address is stopped before any request', !requested);
  await assertLegible(page, qa, 'AUTH-04c');
  await qa.shot(page, 'auth-04c-malformed-email', 'A malformed address, stopped in the browser');
  await page.unroute('**/api/auth/sign-in/**');

  // AUTH-04d — a token that was never issued.
  await page.goto('/reset-password?token=this-token-was-never-issued');
  await page.waitForLoadState('networkidle').catch(() => {});
  const badToken = await assertLegible(page, qa, 'AUTH-04d');
  qa.check(
    'AUTH-04d: an unissued reset token reaches the invalid-link state',
    /invalid|expired|no longer|request a new/i.test(badToken),
    badToken.slice(0, 200),
  );
  await qa.shot(page, 'auth-04d-invalid-reset-token', 'A reset link that was never issued');

  // AUTH-04e — an invitation link with nothing in it.
  await page.goto('/accept-invitation');
  await page.waitForLoadState('networkidle').catch(() => {});
  const badInvitation = await assertLegible(page, qa, 'AUTH-04e');
  qa.check(
    'AUTH-04e: an invitation link with no id says so, rather than offering a dead form',
    /invalid|expired|link/i.test(badInvitation),
    badInvitation.slice(0, 200),
  );
  await qa.shot(
    page,
    'auth-04e-invalid-invitation-link',
    'An invitation link carrying no invitation',
  );

  // AUTH-04f — a guarded route while signed out. The destination has to survive
  // the round trip, or signing in restarts the reader's errand instead of
  // resuming it.
  await page.context().clearCookies();
  await page.goto('/dashboard?tab=activity&from=email');
  await page.waitForLoadState('networkidle').catch(() => {});
  const url = new URL(page.url());
  qa.check(
    'AUTH-04f: a guarded route redirects to the login screen',
    url.pathname.includes('/login'),
    page.url(),
  );
  const redirect = url.searchParams.get('redirect') ?? '';
  qa.check(
    'AUTH-04f: the redirect carries the intended destination',
    redirect.includes('/dashboard'),
    `redirect=${JSON.stringify(redirect)}`,
  );
  qa.check(
    'AUTH-04f: the destination keeps its search params',
    redirect.includes('tab=activity') && redirect.includes('from=email'),
    `redirect=${JSON.stringify(redirect)}`,
  );
  await assertLegible(page, qa, 'AUTH-04f');
  await qa.shot(
    page,
    'auth-04f-guarded-route-redirect',
    'A guarded route, asked for while signed out',
  );

  qa.note(`the account used for the transient cases is ${TRANSIENT.resetMember.email}`);
});
