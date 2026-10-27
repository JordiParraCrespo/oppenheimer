/**
 * Where a session's preview lives (`product/versions/mvp/30-session-previews.md`):
 * one origin per session and port under the deployment's preview domain,
 * `p<port>-<session id as 32 hex>.<domain>`, so an app sees a root path and
 * cookies and storage of its own, as on `localhost:<port>`, and two sessions'
 * apps can never read each other's.
 */

/** The path a preview origin redeems its ticket on, before the app's own. */
export const PREVIEW_ENTER_PATH = '/__oppenheimer/enter';

/** The cookie a preview origin keeps its reader in. Taken off every request the app sees. */
export const PREVIEW_COOKIE = '__oppenheimer_preview';

/** The lowest and highest port a preview reaches: the session's own, never a system one. */
export const PREVIEW_MIN_PORT = 1024;
export const PREVIEW_MAX_PORT = 65535;

export interface PreviewAddress {
  sessionId: string;
  port: number;
}

const LABEL = /^p(\d{4,5})-([0-9a-f]{32})$/;

/** The preview origin of one session's port, under `base` (`http://preview.localhost:3011`). */
export function previewOrigin(base: string, address: PreviewAddress): string {
  const url = new URL(base);
  const hex = address.sessionId.replaceAll('-', '').toLowerCase();
  return `${url.protocol}//p${address.port}-${hex}.${url.host}`;
}

/**
 * The session and port a request's `Host` names, or null when it is not a
 * preview of this deployment: another host, a label that is not one, a port
 * out of range, or a different port than the preview domain is served on.
 */
export function previewAddressOf(
  base: string,
  hostHeader: string | undefined,
): PreviewAddress | null {
  if (!hostHeader) return null;
  const url = new URL(base);
  const host = hostHeader.toLowerCase();
  const suffix = `.${url.host.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const match = LABEL.exec(host.slice(0, -suffix.length));
  if (!match) return null;
  const port = Number(match[1]);
  if (port < PREVIEW_MIN_PORT || port > PREVIEW_MAX_PORT) return null;
  const hex = match[2] as string;
  const sessionId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { sessionId, port };
}

/**
 * Where a preview opens: its origin's enter path with the ticket, the path in
 * the app to land on, and whether the console frames it (which decides the
 * cookie it gets).
 */
export function previewEnterUrl(
  base: string,
  address: PreviewAddress,
  ticket: string,
  options: { path?: string; embed: boolean },
): string {
  const url = new URL(PREVIEW_ENTER_PATH, previewOrigin(base, address));
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('path', safePreviewPath(options.path));
  if (options.embed) url.searchParams.set('embed', '1');
  return url.toString();
}

/**
 * A path inside the app, never a way off it: one that does not start with a
 * single `/` (`//evil.example`, `https:…`, `\\evil`) is the app's root.
 */
export function safePreviewPath(path: string | undefined | null): string {
  if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/';
  return path.length > 2048 ? '/' : path;
}
