import { URLSearchParams } from 'node:url';

/**
 * What never leaves the API in an error report. The event is scrubbed in
 * `beforeSend`, after every integration has added to it, so nothing an
 * integration attaches gets past this.
 *
 * - Credentials: the `Authorization`, `Cookie` and API-key headers, any
 *   query parameter or extra whose name says it holds a secret, and the
 *   token in a path that is itself the credential (`/cloud-files/{token}`).
 * - Bodies: a request body can hold a prompt, a message, a terminal's input or
 *   a pasted key; the route and the correlation id are enough to find it.
 * - The user is reduced to an id: no email, name or IP.
 */

const SECRET_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-runner-token',
  'x-hub-signature',
  'x-hub-signature-256',
  'sentry-hook-signature',
]);

/** A key whose value is a secret by its name: `token`, `apiKey`, `client_secret`, `password`, `code`… */
const SECRET_KEY =
  /token|secret|password|passwd|api[-_]?key|authorization|cookie|ticket|^code$|^state$|signature|dsn/i;

/**
 * Paths whose last segment is a bearer credential: a public route that takes
 * no other proof. A new one is added here, with a case in the spec.
 */
const CREDENTIAL_PATHS = [/(\/cloud-files\/)[^/?#]+/g];

export const REDACTED = '[redacted]';

/** The fields of a Sentry event this touches; the rest passes through as it is. */
export interface ScrubbableEvent {
  request?: {
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
    url?: string;
  };
  user?: { id?: string | number };
  extra?: Record<string, unknown>;
  breadcrumbs?: { data?: Record<string, unknown> }[];
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    const request = event.request;
    if (request.headers) request.headers = scrubHeaders(request.headers);
    delete request.cookies;
    if (request.data !== undefined) request.data = REDACTED;
    if (typeof request.query_string === 'string') {
      request.query_string = scrubQuery(request.query_string);
    } else if (request.query_string !== undefined) {
      request.query_string = REDACTED;
    }
    if (request.url) request.url = scrubUrl(request.url);
  }
  if (event.user) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  if (event.extra) event.extra = scrubRecord(event.extra);
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data) crumb.data = scrubRecord(crumb.data);
    }
  }
  return event;
}

export function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SECRET_HEADERS.has(name.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

export function scrubQuery(query: string): string {
  if (!query) return query;
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  for (const key of [...params.keys()]) {
    if (SECRET_KEY.test(key)) params.set(key, REDACTED);
  }
  return params.toString();
}

function scrubUrl(url: string): string {
  const at = url.indexOf('?');
  if (at === -1) return scrubPath(url);
  return `${scrubPath(url.slice(0, at))}?${scrubQuery(url.slice(at + 1))}`;
}

function scrubPath(path: string): string {
  return CREDENTIAL_PATHS.reduce(
    (scrubbed, pattern) => scrubbed.replace(pattern, `$1${REDACTED}`),
    path,
  );
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SECRET_KEY.test(key)) out[key] = REDACTED;
    else if (key === 'url' && typeof value === 'string') out[key] = scrubUrl(value);
    else out[key] = value;
  }
  return out;
}
