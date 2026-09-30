import { expect, type Page, test } from '@playwright/test';

/**
 * The public site: `/about`, `/privacy` and `/terms`, read by someone who is not
 * signed in — a reviewer checking the OAuth consent screen's links, a person
 * deciding whether to register. None of them may bounce a visitor to `/login`,
 * and each has to be reachable from the others and from the sign-in screen,
 * because that is the only way anyone finds them.
 *
 * Every page asserts its heading **and** a piece of the body below it: a page
 * whose chrome renders over an empty `<main>` (a translation key gone missing,
 * a section that threw) would otherwise pass on the title alone.
 */

/** The footer's legal links, which every public page carries. */
function legalNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Legal information' });
}

test.describe('Public pages, signed out', () => {
  test('about introduces the product and leads to sign-in and the privacy policy', async ({
    page,
  }) => {
    await page.goto('/about');

    await expect(page).toHaveURL(/\/about$/);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'One workspace for your team, with the right access for everyone.',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'What the workspace gives your team' }),
    ).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(3);

    await page.getByRole('link', { name: 'Sign in to the workspace' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/about');
    await page.getByRole('link', { name: 'How we protect data' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  });

  test('privacy lists what is processed and why, and is dated', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
    await expect(page.getByText(/This policy explains what personal data/)).toBeVisible();
    // The sections a reviewer reads it for: what data, and the Google half
    // Google's own verification asks about.
    await expect(page.getByRole('heading', { level: 2, name: '2. Data we process' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '3. Google Sign-In and Google user data' }),
    ).toBeVisible();
    await expect(page.getByText(/^Last updated:/)).toBeVisible();
  });

  test('terms state the rules of use, and are dated', async ({ page }) => {
    await page.goto('/terms');

    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeVisible();
    await expect(page.getByText(/These terms govern authorized access/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '3. Acceptable use' })).toBeVisible();
    await expect(page.getByText(/^Last updated:/)).toBeVisible();
  });

  test('the footer and the header link the pages to each other', async ({ page }) => {
    await page.goto('/about');

    await legalNavigation(page).getByRole('link', { name: 'Terms of service' }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeVisible();

    await legalNavigation(page).getByRole('link', { name: 'Privacy policy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/about$/);

    // And the header's Sign in, from a legal page.
    await page.goto('/terms');
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('the sign-in screen links to the terms and the privacy policy', async ({ page }) => {
    await page.goto('/login');

    // "By continuing you agree to our Terms and Privacy Policy."
    await page.getByRole('link', { name: 'Terms', exact: true }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeVisible();

    await page.goto('/login');
    await page.getByRole('link', { name: 'Privacy Policy', exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  });
});
