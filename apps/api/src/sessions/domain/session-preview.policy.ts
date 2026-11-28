import { isSameOriginPath } from '@oppenheimer/shared/urls';

/**
 * Where a session's preview lives:
 * one origin per session and port under the deployment's preview domain,
 * `p<port>-<session id as 32 hex>.<domain>`, so an app sees a root path and
 * cookies and storage of its own, as on `localhost:<port>`, and two sessions'
 * apps can never read each other's.
 */

/** The path a preview origin redeems its ticket on, before the app's own. */
export const PREVIEW_ENTER_PATH = '/__oppenheimer/enter';

/**
 * The cookie a preview origin keeps its reader in. Taken off every request the
 * app sees. `__Host-`: the browser takes it only `Secure`, on `Path=/` and with
 * no `Domain`, so a page on a sibling preview cannot plant one that this
 * origin would be sent. The name it had before (`__oppenheimer_preview`) is no
 * longer read: a reader holding only that one is sent back through a ticket.
 */
export const PREVIEW_COOKIE = '__Host-oppenheimer_preview';

/**
 * The same cookie where the browser keeps no `Secure` cookie (a plain-http
 * preview domain that is not `localhost`), which cannot carry the prefix.
 * Such a deployment has no protection against a sibling's cookie.
 */
export const PREVIEW_COOKIE_INSECURE = 'oppenheimer_preview';

/** Every name the preview cookie has had, taken off what the app is sent. */
export const PREVIEW_COOKIE_NAMES = [
  PREVIEW_COOKIE,
  PREVIEW_COOKIE_INSECURE,
  '__oppenheimer_preview',
] as const;

/** The preview cookie's name where the browser does, or does not, keep a `Secure` cookie. */
export function previewCookieName(secure: boolean): string {
  return secure ? PREVIEW_COOKIE : PREVIEW_COOKIE_INSECURE;
}

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
 * A path inside the app, never a way off it: one `isSameOriginPath` refuses
 * (`//evil.example`, `https:…`, `\\evil`, `/\t/evil.example`), or one past
 * 2048 characters, is the app's root.
 */
export function safePreviewPath(path: string | undefined | null): string {
  if (!path || !isSameOriginPath(path)) return '/';
  return path.length > 2048 ? '/' : path;
}
