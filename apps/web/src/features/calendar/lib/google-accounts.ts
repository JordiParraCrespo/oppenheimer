import type { CalendarAccent } from '@oppenheimer/design-system-web';
import type {
  GoogleAccountReadStatus,
  GoogleCalendarConnectionEntity,
} from '@oppenheimer/frontend-consumer';

/**
 * A person's Google accounts on the calendar (`23-plan-milestones-stats-accounts.md`
 * §5): each wears a colour by its `colorIndex`, and each is a toggle under the
 * Google layer that is this viewer's alone, kept on this device.
 */

const ACCENTS: readonly CalendarAccent[] = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

/** The colour an account's events wear: the categorical order, by the index the API gave it. */
export function accentOf(colorIndex: number): CalendarAccent {
  return ACCENTS[colorIndex] ?? ACCENTS[0];
}

/** The swatch that names an account's colour beside its address. */
export const ACCENT_SWATCH: Record<CalendarAccent, string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
};

/** How an account's row reads: Reconnect when Google dropped it, a failed dot when its last read did. */
export type AccountRowState = 'connected' | 'revoked' | 'failed';

export function accountRowState(
  connection: GoogleCalendarConnectionEntity,
  read: GoogleAccountReadStatus | undefined,
): AccountRowState {
  if (connection.needsReconnect || read === 'revoked') return 'revoked';
  return read === 'error' ? 'failed' : 'connected';
}

export const HIDDEN_ACCOUNTS_KEY = 'oppenheimer.calendar.hiddenGoogleAccounts';

/** The accounts this viewer switched off; anything unreadable, or storage off, is none. */
export function storedHiddenAccounts(): readonly string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(HIDDEN_ACCOUNTS_KEY) ?? '[]');
    return Array.isArray(stored)
      ? [...new Set(stored.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function rememberHiddenAccounts(ids: readonly string[]) {
  try {
    window.localStorage.setItem(HIDDEN_ACCOUNTS_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing or a full quota: the toggle holds until the page reloads.
  }
}

/** `ids` with `id` flipped. */
export function toggleHiddenAccount(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
}
