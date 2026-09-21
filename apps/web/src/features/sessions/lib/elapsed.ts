/**
 * A duration as the mono clock the provisioning pane shows: `mm:ss` while a
 * start is plausible, `h:mm:ss` past the hour so a session that has been
 * "starting" since yesterday reads as the problem it is rather than as `99:12`.
 */
export function formatElapsed(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
