import { randomUUID } from 'node:crypto';

/** The request/response header that carries a request's correlation id. */
export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * What an id may look like. The id is copied into log lines, problem
 * documents, command and event metadata and outbox rows, so a client-supplied
 * value is only honoured when it is short and made of inert characters.
 */
const VALID_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,64}$/;

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && VALID_CORRELATION_ID.test(value);
}

/**
 * The correlation id of an incoming request, in order of preference:
 *
 * 1. `req.id`, when something earlier in the chain (pino-http or
 *    `RequestContextMiddleware`) already settled on one, so the log line and
 *    the problem document always agree;
 * 2. the client's `x-correlation-id` header, when valid (a repeated header
 *    arrives as an array; only its first value is considered);
 * 3. a fresh UUID.
 *
 * An invalid or oversized header is replaced, never truncated or logged.
 */
export function resolveCorrelationId(req: {
  headers?: Record<string, unknown>;
  id?: unknown;
}): string {
  if (isValidCorrelationId(req.id)) return req.id;
  const raw = req.headers?.[CORRELATION_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isValidCorrelationId(value) ? value : randomUUID();
}
