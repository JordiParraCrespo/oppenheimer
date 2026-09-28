import { useNow } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useLocale } from '../hooks/use-locale';
import { formatRelativeTime } from '../lib/format-date';

/**
 * "2 hours ago", on a clock of its own.
 *
 * The leaf owns the tick, so a minute passing re-renders this text and not
 * the row, card or list around it — the clock sits at the lowest reader, and
 * the time is an input (`useNow`) rather than a `Date.now()` the compiler
 * would cache. `children` words the result: `when` is `null` inside the last
 * minute, which each caller says its own way ("Active now", "connected").
 * Without `children` it renders `when` alone.
 */
export function RelativeTime({
  date,
  interval = 60_000,
  children,
}: {
  date: Date;
  /** How often the text moves; a minute suits anything worded in minutes. */
  interval?: number;
  children?: (when: string | null) => ReactNode;
}) {
  const locale = useLocale();
  const now = useNow(interval);
  const when = formatRelativeTime(date, locale, new Date(now));
  return children ? children(when) : when;
}
