import type { ProblemDetails } from '@oppenheimer/shared';

/**
 * Local twin of `@oppenheimer/shared`'s `isProblemDetails`.
 *
 * `apps/web` may only import *types* from `@oppenheimer/shared` — Rollup cannot
 * tree-shake that package's CJS build — so this module keeps to `import type`
 * and carries the one runtime check it needs.
 */
function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.title === 'string' || typeof candidate.status === 'number';
}

export interface ErrorDefinition {
  readonly code: string;
  readonly message: string;
}

export interface AppErrorOptions {
  /** HTTP status, when the failure came from the API. */
  status?: number;
  /** The API's RFC 7807 problem document, when there was one. */
  problem?: ProblemDetails;
  cause?: unknown;
}

/**
 * A failure surfaced to the presentation layer.
 *
 * When the API is the source, the error keeps its RFC 7807 problem document so
 * a screen can show the server's `detail`, highlight the fields listed in
 * `invalidParams`, and quote the `correlationId` in a bug report — instead of
 * a generic "Failed to fetch users".
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly problem?: ProblemDetails;

  constructor(error: ErrorDefinition, options: AppErrorOptions = {}) {
    super(options.problem?.detail ?? options.problem?.title ?? error.message, {
      cause: options.cause,
    });
    this.code = options.problem?.code ?? error.code;
    this.status = options.status ?? options.problem?.status;
    this.problem = options.problem;
    this.name = 'AppError';
  }

  /** Correlation id to quote when reporting the failure. */
  get correlationId(): string | undefined {
    return this.problem?.correlationId;
  }

  /** Field-level validation failures, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const entries = this.problem?.invalidParams?.map((param) => [param.name, param.reason]) ?? [];
    return Object.fromEntries(entries);
  }
}

/**
 * Normalises anything thrown by a repository call into an {@link AppError}.
 *
 * The generated api-client throws its own `ApiError` with the parsed response
 * on `body`; when that body is a problem document the server's own explanation
 * wins over the caller's generic fallback.
 *
 * Not every failure arrives that way. Better Auth's client rejects through
 * `@oppenheimer/auth`'s `AuthRequestError`, which carries a `status` and its own
 * `code` but no problem document — so both are read off the error directly when
 * there is none. `status` is what distinguishes a failure the server answered
 * from one that never reached it.
 */
export function toAppError(error: unknown, fallback: ErrorDefinition): AppError {
  if (error instanceof AppError) return error;

  const candidate = error as {
    status?: number;
    code?: unknown;
    body?: unknown;
    error?: unknown;
    response?: { status?: number; data?: unknown };
  } | null;
  const body =
    candidate?.body ??
    candidate?.error ??
    candidate?.response?.data ??
    (typeof candidate?.error === 'object' ? candidate.error : undefined);

  if (isProblemDetails(body)) {
    return new AppError(fallback, {
      problem: body as ProblemDetails,
      status: candidate?.status,
      cause: error,
    });
  }

  const code = typeof candidate?.code === 'string' ? candidate.code : undefined;

  return new AppError(code ? { ...fallback, code } : fallback, {
    status: candidate?.status,
    cause: error,
  });
}
