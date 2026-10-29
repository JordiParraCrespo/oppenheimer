import { GMAIL_ACCOUNTS_MAX, GMAIL_LABEL_MAX } from '@oppenheimer/shared';

/** Whether a person holding `held` Gmail accounts may connect one more (five at most). */
export function canConnectAnotherGmailAccount(held: number): boolean {
  return held < GMAIL_ACCOUNTS_MAX;
}

/**
 * The name a new account starts with: the part of its address before the
 * `@`, which the person renames to "Personal" or "Work". Never empty, and
 * never longer than a label may be.
 */
export function defaultGmailLabel(accountEmail: string): string {
  const local = accountEmail.split('@')[0]?.trim() ?? '';
  return (local || accountEmail).slice(0, GMAIL_LABEL_MAX);
}
