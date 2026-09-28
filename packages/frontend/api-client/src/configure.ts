/**
 * Runtime config for the generated hey-api client.
 * Wired from `@oppenheimer/frontend` at app boot (base URL + auth headers).
 *
 * The generated module is created by `pnpm generate:api-client`. Until then
 * this file only types the seam.
 */
export type AuthHeaders = Record<string, string> | Promise<Record<string, string>>;

export type ApiClientConfig = {
  baseUrl: string;
  credentials?: RequestCredentials;
  headers?: () => AuthHeaders;
};

let headersFn: (() => AuthHeaders) | undefined;

export function getAuthHeaders(): AuthHeaders {
  return headersFn?.() ?? {};
}

export function rememberHeaders(headers: () => AuthHeaders): void {
  headersFn = headers;
}

let headersInterceptor: ((request: Request) => Promise<Request>) | undefined;

/**
 * Apply the base URL and the auth headers to the generated client. The cookie
 * rides on `credentials: 'include'`; whatever the auth client returns from
 * `getAuthHeaders()` is set on every request too, for a client that cannot
 * rely on a cookie jar. The interceptor is registered once, and reads the
 * remembered headers function on each request.
 */
export async function applyApiClientConfig(config: ApiClientConfig): Promise<void> {
  rememberHeaders(config.headers ?? (() => ({})));
  const { client } = await import('./generated/client.gen');
  client.setConfig({
    baseUrl: config.baseUrl,
    credentials: config.credentials ?? 'include',
  });
  if (!headersInterceptor) {
    headersInterceptor = async (request) => {
      for (const [name, value] of Object.entries(await getAuthHeaders())) {
        request.headers.set(name, value);
      }
      return request;
    };
    client.interceptors.request.use(headersInterceptor);
  }
}
