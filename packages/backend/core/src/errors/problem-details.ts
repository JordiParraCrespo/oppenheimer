import { STATUS_CODES } from 'node:http';
import {
  DEFAULT_PROBLEM_TYPE,
  type InvalidParam,
  isProblemDetails,
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
} from '@oppenheimer/shared';

export {
  DEFAULT_PROBLEM_TYPE,
  type InvalidParam,
  isProblemDetails,
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
};

/**
 * Where error-type URIs point when nothing else is configured. Deployments
 * override it with `ERROR_TYPE_BASE_URL` so a fork documents its own catalog.
 */
export const DEFAULT_ERROR_TYPE_BASE_URL = 'https://oppenheimer.dev/errors';

/**
 * The RFC 7807 `type` for a catalog error code.
 *
 * Codes become fragments on a single reference page (`…/errors#user_001`)
 * rather than one URL per code, so every type URI actually resolves to the
 * paragraph describing it — RFC 7807 §3.1 asks that the type be
 * dereferenceable to human-readable documentation.
 */
export function problemTypeFor(code: string, baseUrl = DEFAULT_ERROR_TYPE_BASE_URL): string {
  const slug = code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${baseUrl.replace(/[#/]+$/, '')}#${slug}`;
}

/**
 * Human-readable summary for a bare status code, used as the `title` of
 * problems that have no catalog entry (RFC 7807 §4.2 — `about:blank` problems
 * whose title is the status phrase).
 */
export function titleForStatus(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

/** Members every problem document carries beyond the ones the caller supplies. */
export interface ProblemContext {
  /** Request path, recorded as the problem's `instance`. */
  instance?: string;
  correlationId?: string;
  timestamp?: string;
}

/** The members this API defines. Extensions may not claim any of them. */
const RESERVED_MEMBERS: ReadonlySet<string> = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'code',
  'correlationId',
  'timestamp',
  'invalidParams',
]);

export interface ProblemInput {
  status: number;
  type?: string;
  title?: string;
  detail?: string;
  code?: string;
  invalidParams?: InvalidParam[];
  /**
   * Extra members merged into the document. Anything named after a member the
   * API defines is dropped — a thrower must not be able to rewrite the status
   * a response is sent with, or the correlation id the logs are keyed by.
   */
  extensions?: Record<string, unknown>;
}

/**
 * Assembles a problem document, dropping empty members so the response stays
 * the minimum RFC 7807 requires plus whatever we actually know.
 */
export function buildProblemDetails(
  problem: ProblemInput,
  context: ProblemContext = {},
): ProblemDetails {
  const { status, type, title, detail, code, invalidParams, extensions } = problem;

  return {
    ...safeExtensions(extensions),
    type: type ?? DEFAULT_PROBLEM_TYPE,
    title: title ?? titleForStatus(status),
    status,
    ...(detail ? { detail } : {}),
    ...(context.instance ? { instance: context.instance } : {}),
    ...(code ? { code } : {}),
    ...(invalidParams?.length ? { invalidParams } : {}),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    timestamp: context.timestamp ?? new Date().toISOString(),
  };
}

function safeExtensions(extensions?: Record<string, unknown>): Record<string, unknown> {
  if (!extensions) return {};
  return Object.fromEntries(
    Object.entries(extensions).filter(([name]) => !RESERVED_MEMBERS.has(name)),
  );
}
