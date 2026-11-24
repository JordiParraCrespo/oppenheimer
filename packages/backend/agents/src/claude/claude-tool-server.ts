import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { BotEngineTool, BotSteering } from '../bot-engine';
import { deliverSteers, runTool, type ToolCallData } from '../turn';

/** Where Claude Code names, in a call's `_meta`, the tool use the call answers. */
const TOOL_USE_ID_META = 'claudecode/toolUseId';

/** The MCP server name; Claude Code calls our tools `mcp__oppenheimer__<name>`. */
export const TOOL_SERVER_NAME = 'oppenheimer';

const TOOL_PREFIX = `mcp__${TOOL_SERVER_NAME}__`;

export function qualifiedToolName(name: string): string {
  return `${TOOL_PREFIX}${name}`;
}

/**
 * `text` with each of our tool names as Claude Code serves it. Our prompts,
 * descriptions and answers name tools bare (`send_to_session`), and a model
 * that calls one by that name is answered "No such tool" without the tool
 * running; given the served name, it calls that. A name already qualified
 * (the prefix ends in `_`), or inside a longer word, is left as it is.
 */
export function qualifyToolNames(text: string, names: readonly string[]): string {
  if (names.length === 0 || !text) return text;
  const alternatives = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const bare = new RegExp(`(?<![A-Za-z0-9_])(${alternatives})(?![A-Za-z0-9_])`, 'g');
  return text.replace(bare, (name) => qualifiedToolName(name));
}

/** `text` with our tools named as we name them again: what `qualifyToolNames` added, taken off. */
export function unqualifyToolNames(text: string): string {
  return text.split(TOOL_PREFIX).join('');
}

/** Our name for a tool Claude Code reports: the MCP prefix stripped, built-ins as they are. */
export function botToolName(name: string): string {
  return name.startsWith(TOOL_PREFIX) ? name.slice(TOOL_PREFIX.length) : name;
}

/**
 * Our tools as an in-process MCP server. The low-level handlers serve the
 * tools' JSON Schemas as they are, rather than through zod shapes the SDK
 * would turn back into JSON Schema. What a call made goes into `made`
 * under the tool use Claude Code names in the call's `_meta`, for the
 * translator to put on that call's `tool.finished`, and so do the messages
 * the person sent meanwhile, which ride the call's result (`deliverSteers`).
 */
export function createToolServer(
  tools: BotEngineTool[],
  turn: { signal: AbortSignal; apiKey: string; steering?: BotSteering },
  made: ToolCallData,
): McpServer {
  const mcp = new McpServer(
    { name: TOOL_SERVER_NAME, version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const names = tools.map((tool) => tool.name);

  mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: qualifyToolNames(tool.description, names),
      inputSchema: { type: 'object' as const, ...tool.inputSchema },
      // A tool that may not wait is loaded up front; the rest Claude Code may
      // defer behind its tool search (`claudeToolSearch`).
      ...(tool.deferrable ? {} : { _meta: { 'anthropic/alwaysLoad': true } }),
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
    const callId = request.params._meta?.[TOOL_USE_ID_META];
    const result = await runTool(tool, request.params.arguments ?? {}, {
      signal: AbortSignal.any([turn.signal, extra.signal]),
      apiKey: turn.apiKey,
      guard: made.loops,
      ...(typeof callId === 'string' ? { callId } : {}),
    });
    made.record(callId, result.data);
    const text = await deliverSteers(
      qualifyToolNames(result.content, names),
      { steering: turn.steering, signal: turn.signal, callId },
      made,
    );
    return {
      content: [
        { type: 'text' as const, text },
        ...(result.images ?? []).map((image) => ({
          type: 'image' as const,
          data: image.data,
          mimeType: image.mimeType,
        })),
      ],
      isError: result.isError,
    };
  });

  return mcp;
}
