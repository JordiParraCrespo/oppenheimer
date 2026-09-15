import { findUser, sessionsOf, withDb } from '../../src/db.js';
import { scenario, signIn } from '../../src/harness.js';
import { mailCount, waitForMailLink } from '../../src/mail-sink.js';
import { signUpThroughApi, TRANSIENT, visibleMessage } from './accounts.js';

const NEW_PASSWORD = 'QaResetMemberChanged123';

scenario('AUTH-02', async ({ page, qa }) => {
  const account = TRANSIENT.resetMember;
  const created = await signUpThroughApi(page, account);
  qa.check('the member can be created', created);

  // A session to lose. The reset is supposed to end it, and a scenario that
  // never opens one cannot tell a revocation from a no-op.
  await signIn(page, account.email, account.password);
  const user = await withDb((pool) => findUser(pool, account.email));
  const before = user ? await withDb((pool) => sessionsOf(pool, user.id)) : 0;
  qa.note(`${before} session(s) open before the reset`);
  await page.context().clearCookies();

  // Count first, then wait for one *more* than that. The log is append-only
  // across runs, so "the latest link for this address" would happily hand back
  // the one the previous run sent, and the scenario would pass against a token
  // that is already spent.
  const seen = mailCount('PASSWORD RESET', account.email);
  await page.goto('/forgot-password');
  await page.locator('#email').fill(account.email);
  await page.getByRole('button', { name: /send|reset|continue/i }).click();
  await page.waitForTimeout(1500);
  const confirmation = await visibleMessage(page);
  qa.check(
    'the request is confirmed without disclosing whether the account exists',
    !/no account|not found|unknown/i.test(confirmation),
    confirmation.slice(0, 200),
  );
  await qa.shot(page, 'auth-02-reset-requested', 'The reset request, confirmed without disclosure');

  const link = await waitForMailLink('PASSWORD RESET', account.email, { after: seen });
  qa.note(`the mail sink delivered ${link}`);
  await page.goto(link);
  await page.waitForLoadState('networkidle').catch(() => {});
  await qa.shot(page, 'auth-02-reset-form', 'The reset form, reached through the emailed link');

  const passwordField = page.locator('#password').first();
  qa.check(
    'the link lands on a form that can set a new password',
    await passwordField.isVisible().catch(() => false),
  );

  // A password below the minimum is the browser's to refuse. This form refuses
  // it by keeping submit disabled, so the check reads the button rather than
  // clicking it: clicking a disabled button proves nothing and waits out the
  // whole scenario timeout doing it.
  const submit = page.getByRole('button', { name: /reset|save|change|continue/i }).first();
  const confirmField = page.locator('#confirmPassword');
  await passwordField.fill('short');
  if (await confirmField.isVisible().catch(() => false)) await confirmField.fill('short');
  await page.waitForTimeout(500);
  qa.check(
    'a password below the minimum cannot be submitted',
    await submit.isDisabled().catch(() => false),
    'the form states its own rules and keeps submit disabled until they are met',
  );

  await passwordField.fill(NEW_PASSWORD);
  if (await confirmField.isVisible().catch(() => false)) await confirmField.fill(NEW_PASSWORD);
  await page.waitForTimeout(500);
  await submit.click();
  await page.waitForTimeout(3000);

  const signedInWithNew = await signIn(page, account.email, NEW_PASSWORD);
  qa.check('the new password signs in', signedInWithNew);
  await qa.shot(
    page,
    'auth-02-signed-in-with-new-password',
    'Signed in with the password just set',
  );

  await page.context().clearCookies();
  const signedInWithOld = await signIn(page, account.email, account.password);
  qa.check('the old password no longer signs in', !signedInWithOld);

  // A reset link is a bearer credential. One that still works after use is one
  // sitting in a mailbox, an inbox backup and a mail provider's logs.
  await page.context().clearCookies();
  await page.goto(link);
  await page.waitForLoadState('networkidle').catch(() => {});
  const replayed = await visibleMessage(page);
  qa.check(
    'the reset link cannot be replayed',
    /invalid|expired|no longer|request a new/i.test(replayed),
    replayed.slice(0, 200),
  );
  await qa.shot(page, 'auth-02-replayed-link', 'The same reset link, opened a second time');

  const after = user ? await withDb((pool) => sessionsOf(pool, user.id)) : 0;
  qa.note(`${after} session(s) open after the reset`);
  qa.check(
    'the sessions open before the reset are gone',
    after <= 1,
    `${before} before, ${after} after — a reset exists because the reader believes their credential is compromised`,
  );
});
