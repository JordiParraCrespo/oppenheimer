import { FIXTURE_ACCOUNTS, ROSTER_CAST } from '../../fixtures/index.js';
import { API_URL, scenario, signIn } from '../../src/harness.js';
import { looksLikeABreakage, visibleMessage } from './accounts.js';

/**
 * The four people the control plane has to have an answer for.
 *
 * `label` is what the report and the screenshots call them; short, because it
 * appears in every check in the scenario. `platformAdmin` is the expectation,
 * and it comes from `user.role` — which is what the gate reads — rather than
 * from the workspace role, which it does not.
 */
const PEOPLE = [
  {
    label: 'owner',
    email: FIXTURE_ACCOUNTS.roster.email,
    password: FIXTURE_ACCOUNTS.roster.password,
    platformAdmin: false,
  },
  ...ROSTER_CAST.map((person) => ({
    label:
      person.platformRole === 'admin'
        ? 'platform-admin'
        : person.organizationRole === 'admin'
          ? 'admin'
          : 'plain-member',
    email: person.email,
    password: person.password,
    platformAdmin: person.platformRole === 'admin',
  })),
];

scenario('AUTH-08', async ({ page, qa, openAdmin }) => {
  const admin = await openAdmin();

  for (const person of PEOPLE) {
    await admin.context().clearCookies();
    const signedIn = await signIn(admin, person.email, person.password);
    qa.check(`the ${person.label} can authenticate at all`, signedIn, admin.url());

    await admin.goto('/users');
    await admin.waitForLoadState('networkidle').catch(() => {});
    await admin.waitForTimeout(1000);

    const text = await visibleMessage(admin);
    const breakage = looksLikeABreakage(text);
    // The gate's own card, by the sentence it renders — not a keyword sweep.
    // "access" alone also appears in the users screen's own subtitle ("active
    // access"), which read every admitted administrator as refused.
    const refused = /reserved for platform administrators|control plane access required/i.test(
      text,
    );
    // Admitted is the absence of the gate's refusal, not the presence of words
    // that happen to be on the users screen: an empty table says none of them.
    const admitted = !refused && !breakage;

    qa.check(
      `the control plane gives the ${person.label} an answer, not a breakage`,
      !breakage,
      breakage ?? 'reads as prose',
    );
    qa.checkEqual(
      `the control plane admits the ${person.label} only if they are a platform administrator`,
      admitted,
      person.platformAdmin,
    );
    if (!person.platformAdmin) {
      // The three ways a refusal goes wrong without failing an "is the table
      // absent" check: a blank shell, a spinner that never resolves, and a
      // bounce back to the login screen that reads as a credential problem.
      qa.check(
        `the ${person.label} is told they are refused, rather than shown a blank shell`,
        refused,
        text.slice(0, 200),
      );
      const spinning = await admin
        .getByRole('status')
        .first()
        .isVisible()
        .catch(() => false);
      qa.check(`the ${person.label}'s refusal is not a spinner`, !spinning);
      qa.check(
        `the ${person.label} is not bounced back to the login form, which reads as a wrong password`,
        !admin.url().includes('/login'),
        admin.url(),
      );
    }

    // The screen is one half. The endpoint behind it is the other, and a
    // refusal there has to be a refusal rather than a crash.
    const users = await admin.request.get(`${API_URL}/api/v1/users`);
    if (person.platformAdmin) {
      qa.check(
        `the users endpoint answers the ${person.label}`,
        users.ok(),
        `HTTP ${users.status()}`,
      );
    } else {
      qa.check(
        `the users endpoint refuses the ${person.label} with 401 or 403, not a 500`,
        users.status() === 401 || users.status() === 403,
        `HTTP ${users.status()}`,
      );
      const contentType = users.headers()['content-type'] ?? '';
      qa.check(
        `the refusal of the ${person.label} is an RFC 7807 problem document`,
        contentType.includes('problem+json'),
        contentType || '(no content-type)',
      );
    }

    await qa.shot(
      admin,
      `admin-auth-08-${person.label}`,
      `The control plane, opened by the ${person.label}`,
    );

    // The consumer app is a separate promise: being refused the control plane
    // must not mean being locked out of the product.
    await page.context().clearCookies();
    const consumer = await signIn(page, person.email, person.password);
    qa.check(`the consumer app still admits the ${person.label}`, consumer, page.url());
  }
});
