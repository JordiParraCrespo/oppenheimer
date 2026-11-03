import {
  HttpClient,
  type HttpResponse,
  HttpTransportError,
  readProblem,
} from '@oppenheimer/http-client';
import { CliError, ExitCode } from './errors';

export interface ApiClientOptions {
  apiUrl: string;
  /** Bearer credential. Omitted for the sign-in call itself. */
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  /** Extra headers, used by the sign-in flow. */
  headers?: Record<string, string>;
  /** Called with the response headers — how sign-in picks up its token. */
  onHeaders?: (headers: Headers) => void;
  /** Skip the `/api/v1` prefix (for Better Auth's `/api/auth/*` routes). */
  absolute?: boolean;
}

/**
 * The Oppenheimer API as `opp` calls it: `@oppenheimer/http-client`'s
 * transport, which the MCP server shares, with every failure turned into a
 * {@link CliError} carrying the exit code that matches what went wrong, so
 * every command reports authentication, permission and not-found failures
 * the same way without repeating itself.
 */
export class ApiClient {
  private readonly http: HttpClient;

  constructor(options: ApiClientOptions) {
    this.http = new HttpClient(options);
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, options);
  }

  put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const { onHeaders, ...request } = options;
    let response: HttpResponse;
    try {
      response = await this.http.request({ method, path, ...request });
    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw new CliError(
          error.message,
          ExitCode.UNREACHABLE,
          'Check the API is running and that --api-url points at it.',
        );
      }
      throw error;
    }
    onHeaders?.(response.headers);
    if (!response.ok) throw toCliError(response.status, response.payload, method, path);
    return response.payload as T;
  }
}

/**
 * Maps a failed answer onto the exit code that matches what went wrong, with
 * the problem document read by `readProblem`: its code, its detail and the
 * fields it rejected, so a script's stderr says exactly what to fix.
 */
function toCliError(status: number, payload: unknown, method: string, path: string): CliError {
  const { code, message: detail } = readProblem(payload, `${method} ${path} failed with ${status}`);
  const message = code ? `${code}: ${detail}` : detail;

  if (status === 401) {
    return new CliError(message, ExitCode.AUTH, 'Run `opp login` to re-authenticate.');
  }
  if (status === 403) {
    return new CliError(
      message,
      ExitCode.FORBIDDEN,
      'Your credential may be missing a permission — check `opp whoami`.',
    );
  }
  if (status === 404) return new CliError(message, ExitCode.NOT_FOUND);

  return new CliError(message, ExitCode.FAILURE);
}
