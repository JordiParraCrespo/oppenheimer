import {
  HttpClient,
  type HttpResponse,
  HttpTransportError,
  readProblem,
} from '@oppenheimer/http-client';
import type { ProblemDetails, Scope } from '@oppenheimer/shared';

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
 * Typed client for the Oppenheimer REST API, over `@oppenheimer/http-client`'s
 * transport, which `opp` shares: a failed answer becomes an
 * {@link OppenheimerApiError} a tool can phrase for the model.
 *
 * It depends on the HTTP contract, not on a build of the API it talks to, so
 * the server runs as a standalone binary against any deployment.
 */
export class OppenheimerClient {
  private readonly http: HttpClient;

  constructor(options: OppenheimerClientOptions) {
    this.http = new HttpClient(options);
  }

  /** What this credential is and what it can actually do. */
  currentCredential(): Promise<CurrentCredential> {
    return this.request<CurrentCredential>('GET', '/me/credential');
  }

  get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  /** `headers` carries what a write needs beside its body, such as an `Idempotency-Key`. */
  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, body, undefined, headers);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, undefined, query);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T> {
    let response: HttpResponse;
    try {
      response = await this.http.request({ method, path, body, query, headers });
    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw new OppenheimerApiError(
          error.kind === 'timeout' ? 504 : 503,
          error.kind === 'timeout' ? 'MCP_TIMEOUT' : 'MCP_UNREACHABLE',
          error.message,
        );
      }
      throw error;
    }
    if (!response.ok) {
      const read = readProblem(
        response.payload,
        `${method} ${path} failed with ${response.status}`,
      );
      throw new OppenheimerApiError(
        response.status,
        read.code,
        read.message,
        read.correlationId,
        read.problem,
      );
    }
    return response.payload as T;
  }
}
