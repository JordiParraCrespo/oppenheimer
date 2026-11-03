import { isProblemDetails, type ProblemDetails } from '@oppenheimer/shared/types';

/** What a failed answer says, read once for every client of the API. */
export interface ReadProblem {
  /** The catalog code (`SESSIONS_036`), when the API sent one. */
  code?: string;
  /**
   * The occurrence's `detail`, else the problem's `title`, else `fallback`,
   * with the rejected fields appended so the caller can fix the call in one go.
   */
  message: string;
  correlationId?: string;
  /** The whole RFC 7807 document, for a caller that wants a field of it. */
  problem?: ProblemDetails;
}

/** The body an older deployment answered with, before RFC 7807 problem documents. */
interface LegacyErrorBody {
  code?: string;
  message?: string | string[];
  correlationId?: string;
}

/**
 * Read a failed answer's body: an RFC 7807 problem document
 * (`application/problem+json`, what the API answers with), or failing that
 * the `{ code, message }` of an older deployment or a proxy's text.
 */
export function readProblem(payload: unknown, fallback: string): ReadProblem {
  if (isProblemDetails(payload)) {
    const problem = payload as ProblemDetails;
    const fields = (problem.invalidParams ?? []).map((param) => `${param.name}: ${param.reason}`);
    const message = [
      problem.detail ?? problem.title ?? fallback,
      ...(fields.length > 0 ? [`(${fields.join('; ')})`] : []),
    ].join(' ');
    return { code: problem.code, message, correlationId: problem.correlationId, problem };
  }
  const legacy = (payload ?? {}) as LegacyErrorBody;
  const message = Array.isArray(legacy.message) ? legacy.message.join('; ') : legacy.message;
  return { code: legacy.code, message: message ?? fallback, correlationId: legacy.correlationId };
}
