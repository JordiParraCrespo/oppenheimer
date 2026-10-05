import { client } from './generated/client.gen';

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
 * The cookie rides on `credentials: 'include'`; whatever the auth client
 * returns from `headers` is set on every request too, for a client that cannot
 * rely on a cookie jar. Synchronous, so a repository called right after the app
 * is created already sends both.
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
