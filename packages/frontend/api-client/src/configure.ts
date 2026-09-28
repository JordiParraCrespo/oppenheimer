import { client } from './generated/client.gen';

/**
 * Runtime config for the generated client, applied by the kernel at app boot
 * (base URL + auth headers).
 */
export type AuthHeaders = Record<string, string> | Promise<Record<string, string>>;

export type ApiClientConfig = {
  baseUrl: string;
  credentials?: RequestCredentials;
  headers?: () => AuthHeaders;
};

let headersFn: (() => AuthHeaders) | undefined;

function getAuthHeaders(): AuthHeaders {
  return headersFn?.() ?? {};
}

let headersInterceptor: ((request: Request) => Promise<Request>) | undefined;

/**
 * Apply the base URL and the auth headers to the generated client. The cookie
 * rides on `credentials: 'include'`; whatever the auth client returns from
 * `headers` is set on every request too, for a client that cannot rely on a
 * cookie jar. The interceptor is registered once, and reads the remembered
 * headers function on each request. Synchronous, so a repository called right
 * after the app is created already sends both.
 */
export function applyApiClientConfig(config: ApiClientConfig): void {
  headersFn = config.headers;
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
