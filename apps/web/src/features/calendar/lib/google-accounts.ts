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
