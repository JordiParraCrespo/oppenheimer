#!/usr/bin/env node
import '@oppenheimer/env/load';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { OppenheimerClient } from '../client';
import { loadConfig } from '../config';
import { createServer } from '../server';

/**
 * Local entrypoint: an MCP client (Claude Desktop, Claude Code, …) spawns this
 * process and speaks to it over stdio. The credential is a scoped API token
 * from `oppenheimer tokens create`.
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
      'OPPENHEIMER_API_TOKEN is required. Create one with `oppenheimer tokens create --name "Claude" --permissions users:read` (or run `oppenheimer mcp install`).',
    );
  }

  const client = new OppenheimerClient({
    apiUrl: config.apiUrl,
    token: config.apiToken,
    timeoutMs: config.timeoutMs,
  });

  // Ask the API what this token can actually do, rather than trusting the
  // token's own claims or offering everything and failing later. Done once,
  // before serving: the token is fixed for the life of the process, and a bad
  // one should fail loudly at startup instead of on the first tool call.
  const credential = await client.currentCredential();

  const build = () =>
    createServer({
      client,
      scopes: credential.effectiveScopes,
      toolsCacheTtlMs: config.toolsCacheTtlMs,
    });

  const { tools, withheld } = build();
  console.error(
    `[oppenheimer-mcp] connected to ${config.apiUrl} as ${credential.email} (${credential.kind})`,
  );
  console.error(
    `[oppenheimer-mcp] ${tools.length} tools available, ${withheld.length} withheld for lack of permissions`,
  );

  serveStdio(() => build().server, {
    onerror: (error) => console.error(`[oppenheimer-mcp] ${error.message}`),
  });
}

main().catch((error: unknown) => {
  console.error(`[oppenheimer-mcp] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
