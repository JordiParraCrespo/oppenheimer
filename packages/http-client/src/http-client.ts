/**
 * The transport `opp` and the MCP server share. It makes the request and
 * reads the answer; it never decides what a failed answer means. The CLI
 * maps a status onto its exit codes and next-step hints, the MCP server onto
 * a tool result phrased for a model, and both read the problem document the
 * same way (`readProblem`). Only the network failing, which neither can
 * answer from a status, is an error thrown here.
 */

export interface HttpClientOptions {
  /** The API's base URL, without `/api` (`http://localhost:3001`). */
  apiUrl: string;
  /** Bearer credential on every request. Omitted for a call that signs in. */
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface HttpRequest {
  method: string;
  /** A path under `/api/v1`, or under the API's root with `absolute`. */
  path: string;
  /** Empty values (`undefined`, `null`, `''`) are left out, not sent blank. */
  query?: Record<string, unknown>;
  /** Sent as JSON. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip the `/api/v1` prefix (Better Auth's `/api/auth/*` routes). */
  absolute?: boolean;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  /** The body parsed as JSON, `{ message }` for a body that is not, `undefined` for none. */
  payload: unknown;
}

/** The request never got an answer: the API is down or unreachable, or it took too long. */
export class HttpTransportError extends Error {
  constructor(
    readonly kind: 'timeout' | 'unreachable',
    message: string,
  ) {
    super(message);
    this.name = 'HttpTransportError';
  }
}

export class HttpClient {
  readonly apiUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request(request: HttpRequest): Promise<HttpResponse> {
    const base = request.absolute ? this.apiUrl : `${this.apiUrl}/api/v1`;
    const url = new URL(`${base}${request.path}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: request.method,
        headers: {
          accept: 'application/json, application/problem+json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...request.headers,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });
      const text = response.status === 204 ? '' : await response.text();
      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        payload: text ? parseBody(text) : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpTransportError(
          'timeout',
          `${request.method} ${request.path} timed out after ${this.timeoutMs} ms`,
        );
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new HttpTransportError('unreachable', `Could not reach ${this.apiUrl}: ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // A proxy's plain-text 502 still says something worth showing.
    return { message: text };
  }
}
