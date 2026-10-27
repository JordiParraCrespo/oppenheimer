import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http';
import { PREVIEW_COOKIE } from '../../sessions/domain/session-preview.policy';

/**
 * The pieces of a preview origin's HTTP that are pure: its cookie, and what
 * it rewrites so the session's app sees `localhost:<port>` as it would on
 * the host (`product/versions/mvp/28-session-previews.md`).
 */

/** How long a reader stays in a preview without opening it again from the console. */
export const PREVIEW_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

/** What a preview's cookie says: whose reading of which session's port, until when. */
export interface PreviewCookieClaim {
  sessionId: string;
  port: number;
  userId: string;
  organizationId: string;
  expiresAt: number;
}

/** The cookie's signing key, derived from the auth secret for this one use. */
export function previewCookieKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'oppenheimer', 'preview-cookie', 32));
}

export function signPreviewCookie(key: Buffer, claim: PreviewCookieClaim): string {
  const body = Buffer.from(
    JSON.stringify({
      s: claim.sessionId,
      p: claim.port,
      u: claim.userId,
      o: claim.organizationId,
      e: claim.expiresAt,
    }),
  ).toString('base64url');
  return `${body}.${mac(key, body)}`;
}

/** The claim a cookie carries, or null when it is forged, malformed or expired. */
export function verifyPreviewCookie(
  key: Buffer,
  value: string | undefined,
  now: number,
): PreviewCookieClaim | null {
  if (!value) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(mac(key, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const claim = {
      sessionId: String(raw.s),
      port: Number(raw.p),
      userId: String(raw.u),
      organizationId: String(raw.o),
      expiresAt: Number(raw.e),
    };
    return claim.expiresAt > now ? claim : null;
  } catch {
    return null;
  }
}

function mac(key: Buffer, body: string): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

/** One cookie's value out of a `Cookie` header. */
export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

/**
 * The `Set-Cookie` that keeps a reader in a preview. Framed by the console it
 * is `SameSite=None; Partitioned`, so it is sent only under the console's
 * site: another site that frames or posts to the preview carries none. Opened
 * in a tab of its own it is `Lax`. `Secure` wherever the browser takes it
 * (https, or a `localhost` name).
 */
export function previewSetCookie(
  value: string,
  options: { embed: boolean; secure: boolean },
): string {
  const parts = [
    `${PREVIEW_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(PREVIEW_COOKIE_TTL_MS / 1000)}`,
  ];
  if (options.embed && options.secure) parts.push('SameSite=None', 'Secure', 'Partitioned');
  else {
    parts.push('SameSite=Lax');
    if (options.secure) parts.push('Secure');
  }
  return parts.join('; ');
}

/** Headers that describe one hop, never forwarded. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * What tells the app where the request really came from. Dropped: the app
 * answers as on the host, and a framework that compares a forwarded host with
 * the `Origin` (Next's server actions) would refuse the preview.
 */
const FORWARDING = new Set([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-real-ip',
]);

/**
 * The request's headers as the app is sent them: `Host` is `localhost:<port>`,
 * `Origin` and `Referer` that name the preview name `localhost:<port>`
 * instead, the preview's own cookie is taken out, and with `upgrade` the
 * hop-by-hop headers a WebSocket handshake needs are kept.
 */
export function upstreamHeaders(
  headers: IncomingHttpHeaders,
  options: { previewOrigin: string; port: number; upgrade: boolean },
): Record<string, string | string[]> {
  const local = `http://localhost:${options.port}`;
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (FORWARDING.has(name)) continue;
    if (
      HOP_BY_HOP.has(name) &&
      !(options.upgrade && (name === 'connection' || name === 'upgrade'))
    ) {
      continue;
    }
    out[name] = value;
  }
  out.host = `localhost:${options.port}`;
  if (out.origin === options.previewOrigin) out.origin = local;
  const referer = out.referer;
  if (
    typeof referer === 'string' &&
    (referer === options.previewOrigin || referer.startsWith(`${options.previewOrigin}/`))
  ) {
    out.referer = local + referer.slice(options.previewOrigin.length);
  }
  const cookie =
    typeof out.cookie === 'string' ? withoutCookie(out.cookie, PREVIEW_COOKIE) : undefined;
  if (cookie) out.cookie = cookie;
  else delete out.cookie;
  return out;
}

function withoutCookie(header: string, name: string): string {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && part.split('=')[0] !== name)
    .join('; ');
}

/**
 * The app's response headers as the reader is sent them: a redirect to
 * `localhost:<port>` (or `127.0.0.1`) lands on the preview, a cookie loses
 * the `Domain` that would name localhost, `X-Frame-Options` gives way to
 * `frame-ancestors` naming the console alone, and hop-by-hop headers stay on
 * their hop.
 */
export function downstreamHeaders(
  headers: IncomingHttpHeaders,
  options: { previewOrigin: string; port: number; consoleOrigin: string },
): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name) || name === 'x-frame-options') continue;
    out[name] = value;
  }
  const location = out.location;
  if (typeof location === 'string') {
    out.location = location.replace(
      new RegExp(`^https?://(localhost|127\\.0\\.0\\.1|\\[::1\\]):${options.port}(?=/|$|\\?|#)`),
      options.previewOrigin,
    );
  }
  const cookies = out['set-cookie'];
  if (Array.isArray(cookies)) {
    out['set-cookie'] = cookies.map((cookie) => cookie.replace(/;\s*domain=[^;]*/i, ''));
  }
  // A second policy is enforced beside the app's own: it can only narrow it.
  const own = out['content-security-policy'];
  const frame = `frame-ancestors ${options.consoleOrigin}`;
  const policies: string[] = own === undefined ? [] : Array.isArray(own) ? own : [String(own)];
  // Comma-joined policies are enforced as separate ones, like separate headers.
  out['content-security-policy'] = [...policies, frame].join(', ');
  return out;
}
