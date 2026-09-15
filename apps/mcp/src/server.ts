import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import type { Scope } from '@oppenheimer/shared';
import { OppenheimerApiError, type OppenheimerClient } from './client';
import { ALL_TOOLS, allowedTools, type ToolDefinition, unmetScopes } from './tools';

/**
 * Version reported to clients in each result's
 * `io.modelcontextprotocol/serverInfo`.
 *
 * Read from `package.json` rather than written out here, so a release bump
 * cannot leave the number an agent is told out of step with the one shipped.
 * The relative path resolves the same from `src/` and from the `dist/` build.
 */
export const SERVER_VERSION: string = (
  createRequire(__filename)('../package.json') as { version: string }
).version;

/**
 * How long a client may reuse a `tools/list` result before asking again.
 *
 * `2026-07-28` made list results cacheable so clients stop re-listing on every
 * turn. The scope is always `private`: this server's tool list is derived from
 * the calling credential's permissions, so it is not a response a shared
 * intermediary may hand to anyone else. The TTL is short because revoking a
 * role narrows the list immediately — a stale list only ever over-advertises,
 * and both the handler and the API refuse the call anyway.
 */
const DEFAULT_TOOLS_CACHE_TTL_MS = 60_000;

export interface CreateServerOptions {
  client: OppenheimerClient;
  /**
   * The credential's effective scopes — what it was granted, intersected with
   * what its owner's roles still permit. Only tools covered by these are
   * registered, so `tools/list` never advertises something that would be
   * refused.
   */
  scopes: readonly Scope[];
  /** Overridable for tests. */
  tools?: readonly ToolDefinition[];
  version?: string;
  /** `ttlMs` for `tools/list` results. Zero disables client-side caching. */
  toolsCacheTtlMs?: number;
}

export interface CreatedServer {
  server: McpServer;
  /** Tools registered for this credential, in the order they are advertised. */
  tools: ToolDefinition[];
  /** Tools withheld, with the scopes that would unlock them. */
  withheld: { name: string; missingScopes: readonly Scope[] }[];
}

/**
 * Build an MCP server exposing exactly the tools this credential may use.
 *
 * Filtering happens at registration, so an agent is never shown a capability it
 * cannot exercise. The handler still re-checks before calling the API, and the
 * API enforces the same scopes independently — a bug here cannot turn into
 * unauthorized access, only into a missing tool.
 *
 * Under `2026-07-28` there is no session to hold this decision, so the server
 * is built per request from the credential that request carried. That is why
 * both entrypoints pass a factory rather than a long-lived instance.
 */
export function createServer(options: CreateServerOptions): CreatedServer {
  const catalog = options.tools ?? ALL_TOOLS;
  const scopes = options.scopes;
  // Sorted by name because `2026-07-28` asks servers to return `tools/list` in
  // a deterministic order: clients cache the result, and a list that reshuffles
  // between calls busts both that cache and the model's prompt cache. Compared
  // by code unit rather than `localeCompare`, which varies with the locale of
  // whatever machine the server happens to run on.
  const tools = allowedTools(catalog, scopes).sort((a, b) => (a.name < b.name ? -1 : 1));

  const server = new McpServer(
    { name: 'oppenheimer', version: options.version ?? SERVER_VERSION },
    {
      // `listChanged: false` is the honest answer: this server's tool list is
      // fixed for the credential it was built for, and under `2026-07-28` a
      // client would have to hold a `subscriptions/listen` stream open to hear
      // about a change we never publish. What does change the list — the owner
      // gaining or losing a role — is picked up when the client re-lists after
      // the `ttlMs` below.
      capabilities: { tools: { listChanged: false } },
      cacheHints: {
        'tools/list': {
          ttlMs: options.toolsCacheTtlMs ?? DEFAULT_TOOLS_CACHE_TTL_MS,
          cacheScope: 'private',
        },
      },
      instructions: [
        'Tools for administering a Oppenheimer deployment: users, roles and permissions,',
        'organizations, members, invitations and workspaces.',
        '',
        'This connection is limited to the permissions its credential was granted,',
        'so you are only shown tools it may actually use. If an expected tool is',
        'missing, call `whoami` to see the granted permissions and tell the user',
        'which one to add rather than guessing at a workaround.',
      ].join('\n'),
    },
  );

  // `registerTool` infers its handler's argument type from the schema given at
  // the call site. Here the schemas come from a registry only known at runtime,
  // so there is nothing to infer from; `defineTool` has already tied each
  // handler to its own schema.
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) => void;

  for (const tool of tools) {
    register(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      (args) => runTool(tool, args, options),
    );
  }

  const registered = new Set(tools.map((tool) => tool.name));
  const withheld = catalog
    .filter((tool) => !registered.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      missingScopes: unmetScopes(tool, scopes),
    }));

  return { server, tools, withheld };
}

async function runTool(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  options: CreateServerOptions,
) {
  // Defence in depth: registration already filtered, but re-check so a future
  // refactor cannot quietly widen what a credential reaches.
  const missing = unmetScopes(tool, options.scopes);
  if (missing.length > 0) {
    return toolError(
      `This connection is missing the ${missing.join(', ')} permission${
        missing.length > 1 ? 's' : ''
      } needed for ${tool.name}. Ask the user to grant it on their API token, then reconnect.`,
    );
  }

  try {
    const result = await tool.handler(args, { client: options.client });
    return toolSuccess(result);
  } catch (error) {
    if (error instanceof OppenheimerApiError) {
      const suffix = error.correlationId ? ` (correlation id ${error.correlationId})` : '';
      const hint = error.isPermissionError
        ? ' The credential’s owner may have lost the role that allowed this.'
        : '';
      return toolError(`${error.message}${hint}${suffix}`);
    }
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

function toolSuccess(result: unknown) {
  const text = result === undefined ? 'Done.' : JSON.stringify(result, null, 2);
  return {
    content: [{ type: 'text' as const, text }],
    // Structured output alongside the text, so clients that can consume JSON do
    // not have to parse the rendering. `2026-07-28` widened `structuredContent`
    // to any JSON value, so a list endpoint's array is passed through as-is;
    // the SDK's wire codec still wraps it as `{ result: … }` when answering a
    // 2025-era client, which cannot accept a non-object.
    structuredContent: (result === undefined ? null : result) as never,
  };
}

function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}
