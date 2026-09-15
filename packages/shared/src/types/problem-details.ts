/**
 * RFC 7807 "Problem Details for HTTP APIs" — the API's error wire format.
 *
 * Every non-2xx response the API produces is a problem document served as
 * `application/problem+json`. The five members below are the ones the RFC
 * defines; everything else is an extension member this API adds, and clients
 * that only understand the RFC can ignore them.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  /**
   * URI reference identifying the problem *type*. `about:blank` means "no
   * semantics beyond the HTTP status code" (RFC 7807 §4.2). Catalog errors
   * point at their entry in the error reference, e.g.
   * `https://oppenheimer.dev/errors#user_001`.
   */
  type: string;
  /** Short, human-readable summary of the problem type. Stable per type. */
  title: string;
  /** The HTTP status code, repeated for clients that only read the body. */
  status: number;
  /** Human-readable explanation specific to *this* occurrence. */
  detail?: string;
  /** URI reference identifying the specific occurrence — the request path. */
  instance?: string;
  /** Extension: the machine-readable catalog code, e.g. `USER_001`. */
  code?: string;
  /** Extension: correlation id of the request, for log lookups. */
  correlationId?: string;
  /** Extension: when the problem was produced (ISO 8601). */
  timestamp?: string;
  /** Extension: per-field validation failures (RFC 7807 §3, `invalid-params`). */
  invalidParams?: InvalidParam[];
  /** Extension members are open-ended by design. */
  [key: string]: unknown;
}

/** One field-level validation failure inside {@link ProblemDetails.invalidParams}. */
export interface InvalidParam {
  /** Dotted path to the offending field, e.g. `address.postalCode`. */
  name: string;
  /** Why it was rejected. */
  reason: string;
}

/** Media type every problem document is served with. */
export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

/** Value of {@link ProblemDetails.type} when a problem carries no extra semantics. */
export const DEFAULT_PROBLEM_TYPE = 'about:blank';

/**
 * Narrows an arbitrary parsed response body to {@link ProblemDetails}.
 *
 * Deliberately lenient: it accepts anything carrying a `title` or a numeric
 * `status`, so a client can recognise a problem document even when it comes
 * from a proxy or an older deployment that omits some members.
 */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.title === 'string' || typeof candidate.status === 'number';
}
