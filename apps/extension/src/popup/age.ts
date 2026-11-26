/** "now", "5m", "3h", "2d" — the sidebar's mono age. */
export function age(iso: string | null | undefined, now: number) {
  if (!iso) return undefined;
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes)) return undefined;
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}
