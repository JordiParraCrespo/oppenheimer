import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { BotEngineTool } from '../bot-engine';
import { runTool } from '../turn';

/** The MCP server name; Claude Code calls our tools `mcp__oppenheimer__<name>`. */
export const TOOL_SERVER_NAME = 'oppenheimer';

const TOOL_PREFIX = `mcp__${TOOL_SERVER_NAME}__`;

export function qualifiedToolName(name: string): string {
  return `${TOOL_PREFIX}${name}`;
}

/** Our name for a tool Claude Code reports: the MCP prefix stripped, built-ins as they are. */
export function botToolName(name: string): string {
  return name.startsWith(TOOL_PREFIX) ? name.slice(TOOL_PREFIX.length) : name;
}

/**
 * Our tools as an in-process MCP server. The low-level handlers serve the
 * tools' JSON Schemas as they are, rather than through zod shapes the SDK
 * would turn back into JSON Schema.
 */
export function createToolServer(
  tools: BotEngineTool[],
  turn: { signal: AbortSignal; apiKey: string },
): McpServer {
  const mcp = new McpServer(
    { name: TOOL_SERVER_NAME, version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: { type: 'object' as const, ...tool.inputSchema },
      // Never deferred behind Claude Code's tool search: a bot's tools are few.
      _meta: { 'anthropic/alwaysLoad': true },
    })),
  }));

  mcp.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const tool = byName.get(request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }
    const result = await runTool(tool, request.params.arguments ?? {}, {
      signal: AbortSignal.any([turn.signal, extra.signal]),
      apiKey: turn.apiKey,
    });
    return { content: [{ type: 'text' as const, text: result.content }], isError: result.isError };
  });

  return mcp;
}
