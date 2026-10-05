import { formatTimeAway, useLocale } from '@oppenheimer/frontend-web';
import { useElapsed } from '../hooks/use-elapsed';

/**
 * How long the host has been offline, as the host-link banner writes it
 * ("2m 14s"). Its own leaf, so the one-second tick redraws this text and not
 * the terminal pane.
 */
export function TimeAway({ since }: { since: Date }) {
  const locale = useLocale();
  return <>{useElapsed(since, true, (ms) => formatTimeAway(ms, locale))}</>;
}
