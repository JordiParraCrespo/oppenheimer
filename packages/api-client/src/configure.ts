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

/** Apply base URL + auth headers to both the legacy OpenAPI client and hey-api. */
export async function applyApiClientConfig(config: ApiClientConfig): Promise<void> {
  rememberHeaders(config.headers ?? (() => ({})));
  const { client } = await import('./generated/client.gen');
  client.setConfig({
    baseUrl: config.baseUrl,
    credentials: config.credentials ?? 'include',
  });
}
