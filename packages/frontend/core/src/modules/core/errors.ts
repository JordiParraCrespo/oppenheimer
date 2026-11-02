import type { ProblemDetails } from '@oppenheimer/shared';

/** Local twin of `@oppenheimer/shared`'s `isProblemDetails`. */
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
 * a screen can translate its `code`, highlight the fields listed in
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

  get correlationId(): string | undefined {
    return this.problem?.correlationId;
  }

  get fieldErrors(): Record<string, string> {
    const entries = this.problem?.invalidParams?.map((param) => [param.name, param.reason]) ?? [];
    return Object.fromEntries(entries);
  }
}

/**
 * {@link unwrap} hands a generated SDK call's failure over as
 * `{ status, body }`; when the body is a problem document, the server's
 * explanation wins over the caller's fallback.
 *
 * Better Auth's client rejects through `@oppenheimer/auth`'s `AuthRequestError`
 * instead, with a `status` and `code` but no problem document, so both are read
 * off the error directly. `status` distinguishes a failure the server answered
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

  // Better Auth answers with `{ code, message }` rather than a problem
  // document; its code is still the one thing the resolver can translate.
  const bodyCode = (body as { code?: unknown } | undefined)?.code;
  const code =
    typeof candidate?.code === 'string'
      ? candidate.code
      : typeof bodyCode === 'string'
        ? bodyCode
        : undefined;

  return new AppError(code ? { ...fallback, code } : fallback, {
    status: candidate?.status,
    cause: error,
  });
}

/** What a generated hey-api SDK call resolves to: it never throws. */
export interface SdkResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

/**
 * A generated SDK call's answer, unwrapped: the body, or the failure as an
 * {@link AppError} built on `fallback` that keeps the problem document the API
 * sent and the response's status.
 *
 * Throwing `new AppError(fallback)` instead drops both, and a failure with no
 * status reads to the error resolver as a request that never reached the
 * server — so every refusal the API explains ("that host is offline") would
 * render as "check your connection". A network failure has no response, and so
 * keeps no status, which is the one case that sentence is right for.
 */
export async function unwrap<T>(
  call: Promise<SdkResult<T>> | SdkResult<T>,
  fallback: ErrorDefinition,
): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined) throw toAppError({ status: response?.status, body: error }, fallback);
  return data as T;
}

/**
 * {@link unwrap}, for a call whose success is a body. An empty one is a failed
 * read, not an empty result: returning `[]` or `{}` would render "nothing here"
 * over a request that never succeeded.
 *
 * `isComplete` states what else the body must hold — a paginated envelope's
 * `data`, say — so a repository does not check it again and throw a second,
 * status-less error of its own. Either way the failure keeps the response's
 * status: the server answered, so it is not "could not reach the server".
 */
export async function unwrapBody<T>(
  call: Promise<SdkResult<T>> | SdkResult<T>,
  fallback: ErrorDefinition,
  isComplete: (body: NonNullable<T>) => boolean = () => true,
): Promise<NonNullable<T>> {
  const { data, error, response } = await call;
  if (error !== undefined) throw toAppError({ status: response?.status, body: error }, fallback);
  if (data === undefined || data === null || !isComplete(data as NonNullable<T>)) {
    throw new AppError(fallback, { status: response?.status });
  }
  return data as NonNullable<T>;
}

/** The unwrappers {@link callApi} hands its call, each bound to the call's fallback. */
export interface ApiCall {
  /** {@link unwrapBody}: the body, which must be there. */
  body<T>(
    call: Promise<SdkResult<T>> | SdkResult<T>,
    isComplete?: (body: NonNullable<T>) => boolean,
  ): Promise<NonNullable<T>>;
  /** {@link unwrap}: the answer, which may be empty (a `204`). */
  result<T>(call: Promise<SdkResult<T>> | SdkResult<T>): Promise<T>;
}

/**
 * One API call, its failure reported as `fallback` says: the failure a
 * repository method declares, named once, beside its signature.
 *
 * ```ts
 * findAll(): Promise<ProjectEntity[]> {
 *   return callApi(ProjectsErrors.FETCH_LIST_FAILED, async (api) =>
 *     (await api.body(heyApiSdk.findProjects())).map(toEntity),
 *   );
 * }
 * ```
 *
 * `api.body` and `api.result` unwrap a generated SDK call against
 * `fallback`, keeping the problem document and the status the API sent.
 * Anything else `run` throws (a network failure, a mapper's error) becomes
 * an {@link AppError} built from `fallback`; an `AppError` passes through
 * untouched, so a step that already knows what went wrong keeps its own
 * diagnosis.
 */
export async function callApi<T>(
  fallback: ErrorDefinition,
  run: (api: ApiCall) => Promise<T>,
): Promise<T> {
  const api: ApiCall = {
    body: (call, isComplete) => unwrapBody(call, fallback, isComplete),
    result: (call) => unwrap(call, fallback),
  };
  try {
    return await run(api);
  } catch (error) {
    throw toAppError(error, fallback);
  }
}
