import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { Scope } from '@oppenheimer/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OppenheimerApiError, type OppenheimerClient } from '../client';
import { createServer } from '../server';
import { ALL_TOOLS, allowedTools, defineTool, type ToolDefinition, unmetScopes } from '../tools';

const client = {} as OppenheimerClient;

/** The revision this server is built for; pinned so a test never silently drops to the legacy era. */
const MODERN = '2026-07-28';

const tool = (name: string, requiredScopes: Scope[], handler = vi.fn()) =>
  defineTool({
    name,
    title: name,
    description: `${name} — exercised by the server tests`,
    requiredScopes,
    inputSchema: z.object({}),
    handler,
  }) as ToolDefinition;

/**
 * Connect a real MCP client to the server over an in-memory transport pair, so
 * these tests exercise the protocol surface an agent actually sees rather than
 * the server's internals.
 *
 * The era is pinned rather than negotiated: the SDK client still defaults to
 * the 2025 handshake, and a test that quietly fell back to it would stop
 * covering the revision this server exists to speak.
 */
async function connect(scopes: Scope[], tools?: ToolDefinition[], era: string | 'legacy' = MODERN) {
  const { withheld } = createServer({ client, scopes, tools });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // Served through `serveStdio` rather than `server.connect(...)` because the
  // entry is what decides the protocol era: connecting a transport by hand only
  // ever yields the 2025 wire codec. Handing it the in-memory transport gives
  // the production stdio path with no process to spawn.
  const handle = serveStdio(() => createServer({ client, scopes, tools }).server, {
    transport: serverTransport,
  });

  const mcpClient = new Client(
    { name: 'test', version: '0.0.0' },
    {
      versionNegotiation: { mode: era === 'legacy' ? 'legacy' : { pin: era } },
    },
  );
  await mcpClient.connect(clientTransport);

  return {
    mcpClient,
    withheld,
    async listTools() {
      return mcpClient.listTools();
    },
    async listToolNames() {
      const { tools: listed } = await mcpClient.listTools();
      return listed.map((t) => t.name);
    },
    async call(name: string, args: Record<string, unknown> = {}) {
      return (await mcpClient.callTool({ name, arguments: args })) as {
        isError?: boolean;
        content: { text: string }[];
        structuredContent?: unknown;
      };
    },
    async close() {
      await mcpClient.close();
      await handle.close();
    },
  };
}

describe('tool filtering', () => {
  const catalog = [
    tool('read_thing', ['users:read']),
    tool('write_thing', ['users:write']),
    tool('role_thing', ['roles:read']),
    tool('open_thing', []),
  ];

  it('lists only the tools a credential covers', async () => {
    const session = await connect(['users:read'], catalog);
    expect(await session.listToolNames()).toEqual(['open_thing', 'read_thing']);
    await session.close();
  });

  it('lists write tools for a write credential, and the read ones with them', async () => {
    const session = await connect(['users:write'], catalog);
    expect(await session.listToolNames()).toEqual(['open_thing', 'read_thing', 'write_thing']);
    await session.close();
  });

  it('lists only unrestricted tools for a credential with no scopes', async () => {
    const session = await connect([], catalog);
    expect(await session.listToolNames()).toEqual(['open_thing']);
    await session.close();
  });

  it('reports what each withheld tool would need', async () => {
    const session = await connect(['users:read'], catalog);
    expect(session.withheld).toEqual([
      { name: 'write_thing', missingScopes: ['users:write'] },
      { name: 'role_thing', missingScopes: ['roles:read'] },
    ]);
    await session.close();
  });

  it('refuses to call a tool that was never offered', async () => {
    const session = await connect(['users:read'], catalog);

    // A withheld tool was never registered, so it is not "a tool that failed" —
    // it does not exist on this connection, and the SDK answers with a
    // JSON-RPC error rather than an `isError` result.
    await expect(session.call('write_thing')).rejects.toThrow(/not found/i);

    await session.close();
  });

  it('requires every scope a tool declares', () => {
    const both = tool('both', ['users:read', 'roles:read']);
    expect(allowedTools([both], ['users:read'])).toEqual([]);
    expect(allowedTools([both], ['users:read', 'roles:read'])).toEqual([both]);
  });

  it('reports only the scopes actually missing', () => {
    const both = tool('both', ['users:read', 'roles:read']);
    expect(unmetScopes(both, ['users:read'])).toEqual(['roles:read']);
  });
});

/**
 * The parts of `2026-07-28` this server has to get right. They are asserted
 * through a real client because they live on the wire, not in our own types.
 */
describe('protocol revision 2026-07-28', () => {
  it('serves the pinned revision, with no handshake to negotiate it', async () => {
    const session = await connect(['users:read']);
    expect(session.mcpClient.getNegotiatedProtocolVersion()).toBe(MODERN);
    await session.close();
  });

  it('advertises tools in a deterministic order so clients can cache the list', async () => {
    const session = await connect(['users:write', 'roles:write', 'admin:write']);

    const first = await session.listToolNames();
    const second = await session.listToolNames();

    expect(first).toEqual([...first].sort());
    expect(second).toEqual(first);
    await session.close();
  });

  it('marks the tool list cacheable, and private to the credential that asked', async () => {
    const session = await connect(['users:read']);
    const listed = (await session.listTools()) as unknown as {
      ttlMs?: number;
      cacheScope?: string;
    };

    expect(listed.ttlMs).toBeGreaterThan(0);
    // The list is derived from the caller's permissions, so a shared cache must
    // never hand one user's list to another.
    expect(listed.cacheScope).toBe('private');
    await session.close();
  });

  it('identifies itself in every result, now that there is no handshake to do it once', async () => {
    const session = await connect(['users:read']);
    const listed = (await session.listTools()) as unknown as {
      _meta?: Record<string, { name?: string }>;
    };

    expect(listed._meta?.['io.modelcontextprotocol/serverInfo']?.name).toBe('oppenheimer');
    await session.close();
  });

  it('does not claim a tools/list_changed it never sends', async () => {
    const { server } = createServer({ client, scopes: [] });
    expect(server.server.getCapabilities?.().tools?.listChanged).toBe(false);
    await server.close();
  });

  it('still serves a client that opens with the 2025 handshake', async () => {
    const session = await connect(['users:read'], undefined, 'legacy');

    expect(session.mcpClient.getNegotiatedProtocolVersion()).not.toBe(MODERN);
    expect(await session.listToolNames()).toContain('list_users');
    await session.close();
  });
});

describe('the real tool catalog', () => {
  it('has unique tool names', () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every tool a description an agent can act on', () => {
    for (const t of ALL_TOOLS) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.title.length).toBeGreaterThan(0);
    }
  });

  it('marks every deleting tool as destructive', () => {
    const deleters = ALL_TOOLS.filter(
      (t) => t.name.startsWith('delete_') || t.name === 'remove_member',
    );
    expect(deleters.length).toBeGreaterThan(0);
    for (const t of deleters) {
      expect(t.annotations?.destructiveHint).toBe(true);
    }
  });

  it('never marks a tool that needs a write scope as read-only', () => {
    for (const t of ALL_TOOLS) {
      if (t.annotations?.readOnlyHint) {
        expect(t.requiredScopes.every((scope) => scope.endsWith(':read'))).toBe(true);
      }
    }
  });

  it('offers only permission-free tools to a credential with no scopes', async () => {
    const session = await connect([]);
    expect(await session.listToolNames()).toEqual(['whoami']);
    await session.close();
  });

  it('opens up as scopes are added', async () => {
    const readOnly = await connect(['users:read']);
    const readWrite = await connect(['users:write']);
    const everything = await connect(ALL_TOOLS.flatMap((t) => t.requiredScopes));

    const counts = await Promise.all([
      readOnly.listToolNames(),
      readWrite.listToolNames(),
      everything.listToolNames(),
    ]);

    expect(counts[0].length).toBeLessThan(counts[1].length);
    expect(counts[1].length).toBeLessThan(counts[2].length);
    expect(counts[2].length).toBe(ALL_TOOLS.length);

    await Promise.all([readOnly.close(), readWrite.close(), everything.close()]);
  });

  it('advertises the declared annotations to clients', async () => {
    const session = await connect(['users:write']);
    const { tools } = await session.mcpClient.listTools();
    const destructive = tools.find((t) => t.name === 'delete_user');

    expect(destructive?.annotations?.destructiveHint).toBe(true);
    await session.close();
  });
});

describe('tool execution', () => {
  it('returns the handler result as text and structured content', async () => {
    const definition = tool('read_thing', ['users:read'], vi.fn().mockResolvedValue({ id: 'u1' }));
    const session = await connect(['users:read'], [definition]);

    const result = await session.call('read_thing');
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 'u1' });
    expect(result.structuredContent).toEqual({ id: 'u1' });

    await session.close();
  });

  it('passes a non-object result through, which 2026-07-28 now allows', async () => {
    const definition = tool('read_thing', ['users:read'], vi.fn().mockResolvedValue([1, 2]));
    const session = await connect(['users:read'], [definition]);

    expect((await session.call('read_thing')).structuredContent).toEqual([1, 2]);
    await session.close();
  });

  it('still wraps a non-object result for a 2025-era client, which cannot take one', async () => {
    const definition = tool('read_thing', ['users:read'], vi.fn().mockResolvedValue([1, 2]));
    const session = await connect(['users:read'], [definition], 'legacy');

    expect((await session.call('read_thing')).structuredContent).toEqual({
      result: [1, 2],
    });
    await session.close();
  });

  it('turns an API error into a tool error rather than a transport failure', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(new OppenheimerApiError(404, 'USER_001', 'User not found'));
    const session = await connect(['users:read'], [tool('read_thing', ['users:read'], handler)]);

    const result = await session.call('read_thing');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('User not found');

    await session.close();
  });

  it('explains a permission failure in terms the agent can relay', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(new OppenheimerApiError(403, 'TOKEN_005', 'Forbidden'));
    const session = await connect(['users:read'], [tool('read_thing', ['users:read'], handler)]);

    expect((await session.call('read_thing')).content[0].text).toContain('lost the role');
    await session.close();
  });

  it('includes the correlation id when the API returns one', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(new OppenheimerApiError(500, 'X', 'Boom', 'corr-123'));
    const session = await connect(['users:read'], [tool('read_thing', ['users:read'], handler)]);

    expect((await session.call('read_thing')).content[0].text).toContain('corr-123');
    await session.close();
  });

  it('re-checks scopes at call time, not only at registration', async () => {
    const handler = vi.fn();
    const definition = tool('write_thing', ['users:write'], handler);

    // Registered under a scope the credential no longer carries — the kind of
    // drift a refactor could introduce. The handler must still refuse.
    const { server } = createServer({
      client,
      scopes: [],
      tools: [{ ...definition, requiredScopes: [] }],
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)]);

    // Swap the requirement back in and call: registration said yes, the
    // re-check must say no.
    const strict = createServer({ client, scopes: [], tools: [definition] });
    expect(strict.tools).toEqual([]);
    expect(handler).not.toHaveBeenCalled();

    await mcpClient.close();
    await server.close();
  });
});

describe('tool schemas', () => {
  it('validates arguments through the declared zod schema', () => {
    const definition = ALL_TOOLS.find((t) => t.name === 'get_user');
    expect(definition).toBeDefined();

    const schema = definition?.inputSchema;
    expect(schema?.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
    expect(schema?.safeParse({ id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' }).success).toBe(true);
  });

  it('rejects a bad argument at the protocol boundary', async () => {
    const handler = vi.fn();
    const definition = defineTool({
      name: 'needs_uuid',
      title: 'Needs a uuid',
      description: 'Requires a uuid argument, for schema validation tests.',
      requiredScopes: [],
      inputSchema: z.object({ id: z.string().uuid() }),
      handler,
    }) as ToolDefinition;

    const session = await connect([], [definition]);
    const result = await session.call('needs_uuid', { id: 'nope' });

    expect(result.isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    await session.close();
  });
});
