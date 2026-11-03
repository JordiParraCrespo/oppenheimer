#!/usr/bin/env node
import '@oppenheimer/env/load';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { OppenheimerClient } from '../client';
import { loadConfig } from '../config';
import { createServer } from '../server';

/**
 * Local entrypoint: an MCP client (Claude Desktop, Claude Code, …) spawns this
 * process and speaks to it over stdio. The credential is a scoped API token
 * from `opp tokens create`.
 *
 * `serveStdio` owns the era decision rather than us wiring a transport
 * directly: a client that opens with the `2026-07-28` envelope is served that
 * revision, and one that still opens with the 2025 `initialize` handshake is
 * pinned to the 2025 era for the life of the connection. Both eras are built
 * from the same factory, so the tool registry is written once and the older
 * clients keep working.
 *
 * Nothing may be written to stdout except protocol messages — diagnostics go to
 * stderr, which MCP clients surface in their logs.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.apiToken) {
    throw new Error(
      'OPPENHEIMER_API_TOKEN is required. Create one with `opp tokens create --name "Claude" --permissions hosts:read,projects:read,sessions:write`, then `opp mcp install`.',
    );
  }

  const client = new OppenheimerClient({
    apiUrl: config.apiUrl,
    token: config.apiToken,
    timeoutMs: config.timeoutMs,
  });

  // Ask the API what this token can actually do, rather than trusting the
  // token's own claims or offering everything and failing later. Once before
  // serving, so a bad token fails loudly at startup instead of on the first
  // tool call.
  const credential = await client.currentCredential();

  const build = (scopes: typeof credential.effectiveScopes) =>
    createServer({ client, scopes, toolsCacheTtlMs: config.toolsCacheTtlMs });

  const { tools, withheld } = build(credential.effectiveScopes);
  console.error(
    `[oppenheimer-mcp] connected to ${config.apiUrl} as ${credential.email} (${credential.kind})`,
  );
  console.error(
    `[oppenheimer-mcp] ${tools.length} tools available, ${withheld.length} withheld for lack of permissions`,
  );

  // And again for every server built after that. The token is fixed for the
  // life of the process, but what it amounts to is not: effective scopes are
  // the token's grant intersected with its owner's roles *now*, so a role
  // change would otherwise leave this process advertising tools the API then
  // refuses, and hiding ones it would allow, until a restart.
  serveStdio(async () => build((await client.currentCredential()).effectiveScopes).server, {
    onerror: (error) => console.error(`[oppenheimer-mcp] ${error.message}`),
  });
}

main().catch((error: unknown) => {
  console.error(`[oppenheimer-mcp] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
