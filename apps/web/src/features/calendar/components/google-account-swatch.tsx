import type { CalendarAccent } from '@oppenheimer/design-system-web';
import { ACCENT_SWATCH } from '../lib/google-accounts';

/** An account's colour, as its events wear it on the month. */
export function GoogleAccountSwatch({ accent }: { accent: CalendarAccent }) {
  return <span aria-hidden className={`block size-2 rounded-pill ${ACCENT_SWATCH[accent]}`} />;
}
