import { isProblemDetails, type ProblemDetails, type Scope } from '@oppenheimer/shared';

/**
 * An API call that failed. Carries the HTTP status and the API's error code so
 * tools can turn it into a message an agent can act on rather than a stack
 * trace. The full RFC 7807 problem document is kept on `problem` for tools
 * that want the field-level detail.
 */
export class OppenheimerApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    readonly correlationId?: string,
    readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'OppenheimerApiError';
  }

  /** Field-level validation failures, when the API reported any. */
  get invalidParams(): ProblemDetails['invalidParams'] {
    return this.problem?.invalidParams;
  }

  /** Whether the call failed because the credential is missing a permission. */
  get isPermissionError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface CurrentCredential {
  kind: 'session' | 'api-token' | 'oauth';
  userId: string;
  email: string;
  grantedScopes: Scope[] | null;
  effectiveScopes: Scope[];
  organizationIds: string[] | null;
  expiresAt: string | null;
}

export interface OppenheimerClientOptions {
  apiUrl: string;
  /** Credential presented on every request, as `Authorization: Bearer …`. */
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Minimal typed client for the Oppenheimer REST API.
 *
 * Deliberately hand-rolled rather than generated: the MCP server needs to run
 * as a standalone binary against any Oppenheimer deployment, so it depends on the
 * HTTP contract, not on a build artifact of the API it is talking to.
 */
export class OppenheimerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OppenheimerClientOptions) {
    this.baseUrl = `${options.apiUrl.replace(/\/+$/, '')}/api/v1`;
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** What this credential is and what it can actually do. */
  currentCredential(): Promise<CurrentCredential> {
    return this.request<CurrentCredential>('GET', '/me/credential');
  }

  get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: 'application/json, application/problem+json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 204) return undefined as T;

      const text = await response.text();
      const payload = text ? safeParse(text) : undefined;

      if (!response.ok) {
        throw toApiError(response.status, payload, method, path);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof OppenheimerApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OppenheimerApiError(504, 'MCP_TIMEOUT', `${method} ${path} timed out`);
      }
      throw new OppenheimerApiError(
        503,
        'MCP_UNREACHABLE',
        `Could not reach the Oppenheimer API at ${this.baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Turns a failed response body into a {@link OppenheimerApiError}.
 *
 * The API answers with an RFC 7807 problem document, whose `detail` explains
 * this occurrence and whose `title` names the problem type. Anything else —
 * a proxy's plain-text 502, an older deployment's `{ message }` body — falls
 * back to whatever text is there.
 */
function toApiError(
  status: number,
  payload: unknown,
  method: string,
  path: string,
): OppenheimerApiError {
  const fallback = `${method} ${path} failed with ${status}`;

  if (isProblemDetails(payload)) {
    const problem = payload as ProblemDetails;
    const message = [problem.detail ?? problem.title ?? fallback, describeInvalidParams(problem)]
      .filter(Boolean)
      .join(' ');
    return new OppenheimerApiError(status, problem.code, message, problem.correlationId, problem);
  }

  const legacy = (payload ?? {}) as {
    code?: string;
    message?: string;
    correlationId?: string;
  };
  return new OppenheimerApiError(
    status,
    legacy.code,
    legacy.message ?? fallback,
    legacy.correlationId,
  );
}

/** Renders `invalidParams` inline so an agent can fix the call without a second round-trip. */
function describeInvalidParams(problem: ProblemDetails): string {
  if (!problem.invalidParams?.length) return '';
  const fields = problem.invalidParams.map((param) => `${param.name}: ${param.reason}`);
  return `(${fields.join('; ')})`;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
