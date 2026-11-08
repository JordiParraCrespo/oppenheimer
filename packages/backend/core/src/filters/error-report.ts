import { HttpException } from '@nestjs/common';
import type { ErrorReportContext } from '@oppenheimer/backend-error-reporting';
import type { ProblemDetails } from '../errors/problem-details';

/** What the router and the auth guards leave on a request, as far as a report reads it. */
export interface ReportedRequest {
  method?: string;
  route?: { path?: string };
  user?: { id?: unknown } | null;
  session?: { activeOrganizationId?: unknown } | null;
}

/**
 * The report of a 5xx, from the problem the filter already built. A framework
 * exception (an `AppError` is one) was thrown on purpose, usually for a
 * dependency, so it is a warning grouped by its code; anything else is an
 * error grouped by its stack. Pure.
 */
export function errorReportOf(
  exception: unknown,
  problem: ProblemDetails,
  request: ReportedRequest | undefined,
): ErrorReportContext {
  const code = problem.code;
  return {
    level: exception instanceof HttpException ? 'warning' : 'error',
    tags: {
      'http.method': request?.method,
      'http.route': request?.route?.path,
      'http.status_code': problem.status,
      'error.code': code,
    },
    fingerprint: code ? ['app-error', code] : undefined,
    userId: idOf(request?.user?.id),
    workspaceId: idOf(request?.session?.activeOrganizationId),
  };
}

function idOf(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
