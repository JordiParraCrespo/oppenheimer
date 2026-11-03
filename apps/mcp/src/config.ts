import { z } from 'zod';

/**
 * Configuration for both entrypoints. Everything comes from the environment so
 * the server can be dropped into an MCP client's config without a config file.
 */
const schema = z.object({
  /** Base URL of the Oppenheimer API, without the `/api` prefix. */
  apiUrl: z.string().url().default('http://localhost:3001'),
  /**
   * API token used by the stdio entrypoint. Not required by the HTTP
   * entrypoint, where each request carries its own credential.
   */
  apiToken: z.string().trim().min(1).optional(),
  /** Port for the Streamable HTTP entrypoint. */
  port: z.coerce.number().int().positive().default(3005),
  /** Request timeout in milliseconds. */
  timeoutMs: z.coerce.number().int().positive().default(30_000),
  /**
   * `ttlMs` advertised on `tools/list` results, which `2026-07-28` made
   * cacheable. Zero tells clients not to cache the list at all.
   */
  toolsCacheTtlMs: z.coerce.number().int().nonnegative().optional(),
  /**
   * Origins allowed to reach the HTTP entrypoint from a browser. An empty list
   * disables cross-origin access, which is the right default for a server
   * spoken to by native MCP clients.
   */
  allowedOrigins: z.array(z.string()).default([]),
});

export type McpConfig = z.infer<typeof schema>;

/**
 * A blank variable (`OPPENHEIMER_API_TOKEN=` in a `.env`) is an absent one, as
 * the API's config reads it: otherwise it fails the schema with a bare Zod
 * error instead of reaching the entrypoint's own "token required" message, or
 * shadows a default with an empty string.
 */
function orUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  return schema.parse({
    apiUrl: orUndefined(env.OPPENHEIMER_API_URL),
    apiToken: orUndefined(env.OPPENHEIMER_API_TOKEN),
    // MCP_PORT first: in a shared root .env, PORT belongs to the API (3001),
    // and the HTTP entrypoint must not collide with it.
    port: orUndefined(env.MCP_PORT) ?? orUndefined(env.PORT),
    timeoutMs: orUndefined(env.OPPENHEIMER_TIMEOUT_MS),
    toolsCacheTtlMs: orUndefined(env.OPPENHEIMER_TOOLS_CACHE_TTL_MS),
    allowedOrigins: orUndefined(env.OPPENHEIMER_ALLOWED_ORIGINS)
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
}
