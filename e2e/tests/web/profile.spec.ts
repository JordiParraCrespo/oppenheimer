import { expect, type Page, test } from '@playwright/test';
import { provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * The profile screen, end to end.
 *
 * Every assertion goes through the real API: a save is followed by
 * `reloadFromServer`, so a test only passes if the value came back from the
 * server rather than from the component state that wrote it. Each spec mints
 * its own account, so nothing here contends with another test's rows.
 */

/** The profile sub-nav, addressed by its accessible name. */
function sectionNav(page: Page) {
  return page.getByRole('navigation', { name: 'My profile' });
}

async function openPane(page: Page, label: string, heading: string) {
  await sectionNav(page).getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible();
}

/** Every row of the session list. */
function sessionRows(page: Page) {
  return page.locator('[data-slot=section-row]');
}

/** The card above the sub-nav, as opposed to the sidebar's account row. */
function hero(page: Page) {
  return page
    .locator('[data-slot=card]')
    .filter({ has: page.getByRole('button', { name: 'Change photo' }) });
}

async function openProfile(page: Page) {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My profile', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

test('shows the signed-in account, read from the API', async ({ page }) => {
  const { user, api } = await provisionedUser('profile');
  await signInAs(page, user);
  await openProfile(page);

  const card = hero(page);
  await expect(card.getByRole('heading', { name: user.name })).toBeVisible();
  await expect(card.getByText(user.email)).toBeVisible();
  await expect(card.getByText(/Joined \w+ \d{4}/)).toBeVisible();

  await api.dispose();
});

test('lists every pane and moves between them', async ({ page }) => {
  const { user, api } = await provisionedUser('profilenav');
  await signInAs(page, user);
  await openProfile(page);

  const nav = sectionNav(page);
  for (const label of ['Profile', 'Password', 'Sessions', 'Preferences']) {
    await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
  }

  await expect(page.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
  await openPane(page, 'Password', 'Password');
  await openPane(page, 'Sessions', 'Sessions');
  await openPane(page, 'Preferences', 'Preferences');
  await openPane(page, 'Profile', 'Profile');

  await api.dispose();
});

test('opens the team page from the card', async ({ page }) => {
  const { user, api } = await provisionedUser('profileteam');
  await signInAs(page, user);
  await openProfile(page);

  // A link rendered through the design system's `Button`, which is what gives
  // it `role="button"`.
  await page.getByRole('button', { name: 'View team card' }).click();
  await expect(page).toHaveURL(/\/team$/);

  await api.dispose();
});

test.describe('the avatar', () => {
  // A 1×1 PNG is enough: the point is not the pixels but that the stored image
  // is fetched and *decoded* (`naturalWidth > 0`), which only holds if the API
  // actually serves the `/uploads` path the upload hands back.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  const avatarImage = (page: Page) => hero(page).locator('[data-slot=avatar-image]');

  test('uploads a picture and renders it, read back from the API', async ({ page }) => {
    const { user, api } = await provisionedUser('avatar');
    await signInAs(page, user);
    await openProfile(page);

    // The initials fallback, with no <img> committed to the DOM.
    const fallback = hero(page).locator('[data-slot=avatar-fallback]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveText('TU');
    await expect(avatarImage(page)).toHaveCount(0);

    await hero(page).locator('input[type=file]').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    // The picture actually renders: Base UI commits the <img> only once the src
    // loads, and a decoded image has a non-zero natural width.
    const img = avatarImage(page);
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    // And it survives a reload with the cache thrown away, so the src is the
    // server's and not the mutation response the page just wrote.
    await reloadFromServer(page);
    await expect(hero(page).getByRole('button', { name: 'Change photo' })).toBeVisible({
      timeout: 30_000,
    });
    const reloaded = avatarImage(page);
    await expect(reloaded).toBeVisible();
    await expect
      .poll(() => reloaded.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    await api.dispose();
  });

  test('rejects a file that is not an accepted image type', async ({ page }) => {
    const { user, api } = await provisionedUser('avatarbad');
    await signInAs(page, user);
    await openProfile(page);

    await hero(page)
      .locator('input[type=file]')
      .setInputFiles({
        name: 'not-an-image.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('this is not an image'),
      });

    // The upload error surfaces as an alert beside the card, and the avatar
    // stays on its fallback.
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(avatarImage(page)).toHaveCount(0);

    await api.dispose();
  });
});

test.describe('the profile form', () => {
  test('fills itself from the saved account and keeps the email read-only', async ({ page }) => {
    const { user, api } = await provisionedUser('profileform');
    await signInAs(page, user);
    await openProfile(page);

    await expect(page.getByLabel('First name')).toHaveValue(user.firstName);
    await expect(page.getByLabel('Last name')).toHaveValue(user.lastName);

    const email = page.getByLabel('Email');
    await expect(email).toHaveValue(user.email);
    await expect(email).toHaveAttribute('readonly', '');
    await expect(page.getByText('Managed by your workspace')).toBeVisible();

    await api.dispose();
  });

  test('saves an edit, and the server is the one that remembers it', async ({ page }) => {
    const { user, api } = await provisionedUser('profilesave');
    await signInAs(page, user);
    await openProfile(page);

    await page.getByLabel('Job title').fill('Head of Everything');
    await page.getByLabel('Phone').fill('+34 600 111 222');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await reloadFromServer(page);
    await expect(page.getByLabel('Job title')).toHaveValue('Head of Everything');
    await expect(page.getByLabel('Phone')).toHaveValue('+34 600 111 222');

    // The shell reads the name from its own query; renaming has to reach it.
    await page.getByLabel('First name').fill('Renamed');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      hero(page).getByRole('heading', { name: `Renamed ${user.lastName}` }),
    ).toBeVisible();
    await expect(
      page.locator('[data-sidebar=menu-button]').getByText(`Renamed ${user.lastName}`),
    ).toBeVisible();

    // A cleared optional field is `null` over the wire, not `""` — the API
    // draws that distinction, and only a reload proves which one it stored.
    await page.getByLabel('Job title').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await reloadFromServer(page);
    await expect(page.getByLabel('Job title')).toHaveValue('');

    await api.dispose();
  });

  test('refuses an empty name and leaves the saved one alone', async ({ page }) => {
    const { user, api } = await provisionedUser('profileempty');
    await signInAs(page, user);
    await openProfile(page);

    await page.getByLabel('First name').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('This field is required')).toBeVisible();

    await reloadFromServer(page);
    await expect(page.getByLabel('First name')).toHaveValue(user.firstName);

    await api.dispose();
  });

  test('cancel puts the saved values back', async ({ page }) => {
    const { user, api } = await provisionedUser('profilecancel');
    await signInAs(page, user);
    await openProfile(page);

    await page.getByLabel('First name').fill('Someone else');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByLabel('First name')).toHaveValue(user.firstName);

    await api.dispose();
  });
});

test.describe('the password pane', () => {
  test('will not submit two passwords that differ', async ({ page }) => {
    const { user, api } = await provisionedUser('pwmismatch');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Password', 'Password');

    await page.getByLabel('Current password').fill(user.password);
    await page.getByLabel('New password').fill('battery-staple');
    await page.getByLabel('Confirm password').fill('battery-stapler');
    await page.getByRole('button', { name: 'Update password' }).click();

    await expect(page.getByText('Both passwords must be the same.')).toBeVisible();

    await api.dispose();
  });

  test('will not submit a new password that is too short', async ({ page }) => {
    const { user, api } = await provisionedUser('pwshort');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Password', 'Password');

    await page.getByLabel('Current password').fill(user.password);
    await page.getByLabel('New password').fill('short');
    await page.getByLabel('Confirm password').fill('short');
    await page.getByRole('button', { name: 'Update password' }).click();

    // The number is `PASSWORD_MIN_LENGTH` in `@oppenheimer/shared`, read here as the
    // copy the reader actually sees. e2e does not depend on that package.
    await expect(page.getByText(/at least 12/i).first()).toBeVisible();

    await api.dispose();
  });

  test('reports a wrong current password in the reader’s language', async ({ page }) => {
    const { user, api } = await provisionedUser('pwwrong');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Password', 'Password');

    await page.getByLabel('Current password').fill('not-my-password');
    await page.getByLabel('New password').fill('battery-staple');
    await page.getByLabel('Confirm password').fill('battery-staple');
    await page.getByRole('button', { name: 'Update password' }).click();

    await expect(page.getByRole('alert')).toContainText('That current password is not right.');

    await api.dispose();
  });

  test('changes the password and signs the other devices out', async ({ page, browser }) => {
    const { user, api } = await provisionedUser('pwchange');
    // A second real sign-in, so there is something for the change to revoke.
    const other = await browser.newContext();
    await signInAs(await other.newPage(), user);

    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Password', 'Password');

    const next = 'Rotated!Password9';
    await page.getByLabel('Current password').fill(user.password);
    await page.getByLabel('New password').fill(next);
    await page.getByLabel('Confirm password').fill(next);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText(/password updated/i).first()).toBeVisible();

    await openPane(page, 'Sessions', 'Sessions');
    await expect(sessionRows(page)).toHaveCount(1);

    await other.close();
    await api.dispose();
  });

  test('shows two-factor as a row it cannot yet switch on', async ({ page }) => {
    const { user, api } = await provisionedUser('pw2fa');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Password', 'Password');

    await expect(page.getByText('Two-factor authentication', { exact: true })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Two-factor authentication' })).toBeDisabled();

    await api.dispose();
  });
});

test.describe('the sessions pane', () => {
  test('marks the browser reading the page, and refuses to revoke it', async ({ page }) => {
    const { user, api } = await provisionedUser('sessions');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Sessions', 'Sessions');

    const current = sessionRows(page).filter({ hasText: 'This device' });
    await expect(current).toHaveCount(1);
    await expect(current.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await expect(current).toContainText(/Chrome|Chromium|Safari|Firefox/);

    await api.dispose();
  });

  test('signs one other device out', async ({ page, browser }) => {
    const { user, api } = await provisionedUser('sessionsone');
    const other = await browser.newContext();
    await signInAs(await other.newPage(), user);

    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Sessions', 'Sessions');

    // The API context that provisioned the account holds a session too, so
    // there are at least three rows before anything is revoked.
    const before = await sessionRows(page).count();
    expect(before).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
    await expect(sessionRows(page)).toHaveCount(before - 1);

    // The row is gone because the server dropped it, not because the list
    // re-rendered without it.
    await reloadFromServer(page);
    await openPane(page, 'Sessions', 'Sessions');
    await expect(sessionRows(page)).toHaveCount(before - 1);

    await other.close();
    await api.dispose();
  });

  test('leaves an API key’s own session off the device list', async ({ page }) => {
    // A credential reaching the API mints a Better Auth session for itself, and
    // those rows used to be drawn here as devices — each with a Sign out
    // button that revoked nothing the key could not re-mint.
    const { user, api } = await provisionedUser('sessionskey');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Sessions', 'Sessions');
    const before = await sessionRows(page).count();

    const credential = await page.evaluate(async () => {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: `e2e-sessions-${Date.now()}`, scopes: ['profile:read'] }),
      });
      return {
        status: response.status,
        ...((await response.json()) as { id: string; token: string }),
      };
    });
    expect(credential.status).toBe(201);

    const statuses = await page.evaluate(async (secret) => {
      const codes: number[] = [];
      for (let call = 0; call < 3; call++) {
        const response = await fetch('/api/v1/profile', {
          headers: { authorization: `Bearer ${secret}` },
        });
        codes.push(response.status);
      }
      return codes;
    }, credential.token);
    expect(statuses).toEqual([200, 200, 200]);

    await reloadFromServer(page);
    await openPane(page, 'Sessions', 'Sessions');
    await expect(sessionRows(page)).toHaveCount(before);

    await api.dispose();
  });

  test('signs every other device out at once', async ({ page, browser }) => {
    const { user, api } = await provisionedUser('sessionsall');
    const other = await browser.newContext();
    await signInAs(await other.newPage(), user);

    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Sessions', 'Sessions');

    await page.getByRole('button', { name: 'Sign out all other sessions' }).click();

    // Only the browser reading the page survives, and the button has nothing
    // left to do.
    await expect(sessionRows(page)).toHaveCount(1);
    await expect(sessionRows(page).filter({ hasText: 'This device' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Sign out all other sessions' })).toBeDisabled();

    await reloadFromServer(page);
    await openPane(page, 'Sessions', 'Sessions');
    await expect(sessionRows(page)).toHaveCount(1);

    await other.close();
    await api.dispose();
  });
});

test.describe('the preferences pane', () => {
  test('repaints the workspace on the dark theme, and remembers it per device', async ({
    page,
  }) => {
    const { user, api } = await provisionedUser('prefstheme');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Preferences', 'Preferences');

    await page.getByRole('switch', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // The saved document is the server's: a cache-less reload still shows it.
    await reloadFromServer(page);
    await openPane(page, 'Preferences', 'Preferences');
    await expect(page.getByRole('switch', { name: 'Dark theme' })).toBeChecked();

    await page.getByRole('switch', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);

    await api.dispose();
  });

  test('saves the table density, and the server is the one that remembers it', async ({ page }) => {
    const { user, api } = await provisionedUser('prefsdensity');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Preferences', 'Preferences');

    const density = page.getByRole('combobox', { name: 'Table density' });
    await density.click();
    await page.getByRole('option', { name: 'Compact' }).click();
    await expect(density).toContainText('Compact');

    await reloadFromServer(page);
    await openPane(page, 'Preferences', 'Preferences');
    await expect(page.getByRole('combobox', { name: 'Table density' })).toContainText('Compact');

    await api.dispose();
  });

  test('saves a notification preference', async ({ page }) => {
    const { user, api } = await provisionedUser('prefsdigest');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Preferences', 'Preferences');

    const digest = page.getByRole('switch', { name: 'Weekly digest' });
    // The seeded default is on; the first click switches it off.
    await expect(digest).toBeChecked();
    await digest.click();
    await expect(digest).not.toBeChecked();

    await reloadFromServer(page);
    await openPane(page, 'Preferences', 'Preferences');
    await expect(page.getByRole('switch', { name: 'Weekly digest' })).not.toBeChecked();

    await api.dispose();
  });

  test('switches the language of the whole page', async ({ page }) => {
    const { user, api } = await provisionedUser('prefslang');
    await signInAs(page, user);
    await openProfile(page);
    await openPane(page, 'Preferences', 'Preferences');

    await page.getByRole('combobox', { name: 'Language' }).click();
    await page.getByRole('option', { name: 'Español' }).click();
    await expect(page.getByRole('heading', { name: 'Preferencias', level: 2 })).toBeVisible();

    // The saved locale is the account's default on a device that has not
    // chosen for itself: a fresh context signs in and reads a Spanish page.
    const fresh = await page.context().browser()?.newContext();
    if (fresh) {
      const other = await fresh.newPage();
      await signInAs(other, user);
      await expect(other.getByRole('link', { name: 'Ajustes', exact: true })).toBeVisible();
      await fresh.close();
    }

    await api.dispose();
  });
});
