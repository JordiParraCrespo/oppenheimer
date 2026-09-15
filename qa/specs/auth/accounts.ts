import type { Page } from '@playwright/test';
import { API_URL, WEB_URL } from '../../src/harness.js';

/**
 * The accounts the auth theme mints, and the two ways it makes one.
 *
 * Kept apart from `fixtures/accounts.ts`, which owns the long-lived workspace
 * owners. These are transient: the `reset` fixture deletes them so the next run
 * can create them again, which is the only reason a scenario about registering
 * can be run twice.
 */
export interface TransientAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export const TRANSIENT: Record<string, TransientAccount> = {
  resetMember: {
    email: 'reset.member@qa.oppenheimer.dev',
    password: 'QaResetMember123',
    firstName: 'Rita',
    lastName: 'Reset',
  },
  inviteeAdmin: {
    email: 'invitee.admin@qa.oppenheimer.dev',
    password: 'QaInviteeAdmin123',
    firstName: 'Ines',
    lastName: 'Invited',
  },
  inviteeMember: {
    email: 'invitee.member@qa.oppenheimer.dev',
    password: 'QaInviteeMember123',
    firstName: 'Ivan',
    lastName: 'Invited',
  },
  newcomer: {
    email: 'newcomer@qa.oppenheimer.dev',
    password: 'QaNewcomer123',
    firstName: 'Nora',
    lastName: 'Newcomer',
  },
  revokedMember: {
    email: 'revoked.member@qa.oppenheimer.dev',
    password: 'QaRevoked123',
    firstName: 'Remy',
    lastName: 'Revoked',
  },
};

/** The platform seed's accounts. Not created by the pack; assumed present. */
export const SEEDED = {
  superAdmin: { email: 'superadmin@oppenheimer.dev', password: 'superadmin123456' },
};

/**
 * Creates an account through the real sign-up endpoint.
 *
 * Through HTTP rather than SQL because only the endpoint hashes the password
 * the way sign-in will later verify it. `Origin` is Better Auth's CSRF defence:
 * a browser always sends one, a bare request context does not.
 */
export async function signUpThroughApi(page: Page, account: TransientAccount): Promise<boolean> {
  const response = await page.request.post(`${API_URL}/api/auth/sign-up/email`, {
    headers: { Origin: WEB_URL },
    data: {
      email: account.email,
      password: account.password,
      name: `${account.firstName} ${account.lastName}`,
      firstName: account.firstName,
      lastName: account.lastName,
    },
  });
  return response.ok();
}

/** Fills and submits the registration form, the way a visitor does. */
export async function registerThroughUi(page: Page, account: TransientAccount): Promise<void> {
  await page.goto('/register');
  await page.locator('#firstName').fill(account.firstName);
  await page.locator('#lastName').fill(account.lastName);
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.getByRole('button', { name: /create account/i }).click();
}

/**
 * Whatever the screen is currently telling the reader, as one string.
 *
 * Used by the negative cases, which care that *something legible* was said and
 * that it was not a status code or a stack trace. Reading the alert role alone
 * would miss a product that renders its rejection as ordinary text, and that is
 * a different finding from saying nothing at all.
 */
export async function visibleMessage(page: Page): Promise<string> {
  const alert = page.getByRole('alert').first();
  if (await alert.isVisible().catch(() => false)) return ((await alert.textContent()) ?? '').trim();
  // The body, not `main`: this app's `main` is the shell header in several
  // layouts, so reading it returned the product name for every screen and made
  // every "did it say anything" check answer the same way.
  return ((await page.locator('body').innerText()) ?? '').trim();
}

/** The tell-tales of a page that broke rather than refused. */
export function looksLikeABreakage(text: string): string | undefined {
  if (/\bat [A-Za-z$_][\w$.]*\s*\(/.test(text)) return 'a stack trace';
  if (/\b(Internal Server Error|ECONNREFUSED|TypeError|undefined is not)\b/.test(text)) {
    return 'a raw runtime error';
  }
  if (/^\s*(4\d{2}|5\d{2})\s*$/.test(text)) return 'a bare status code';
  if (text.trim() === '') return 'an empty screen';
  return undefined;
}
