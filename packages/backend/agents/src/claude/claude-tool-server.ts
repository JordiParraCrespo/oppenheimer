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
 * What a bot is told about calling its tools on this engine, after its own
 * system prompt. Everything a model reads names our tools bare
 * (`send_to_session`): the prompt, the turn's message and wakes, the tools'
 * descriptions and answers. Claude Code serves them only as
 * `mcp__oppenheimer__<name>`, and a call by the bare name is answered "No
 * such tool" without the tool running (2026-11-24: about half of a bot eval's
 * runs). Said once rather than rewritten into those texts, which carry the
 * person's words and the world's (`react`, `remember`, a path), and fixed for
 * every turn, so the prompt cache holds.
 */
export const TOOL_NAMES_NOTE = [
  'How to call your tools here: each one is served as',
  `${TOOL_PREFIX}<name>. Wherever a tool is named by its plain name (in these instructions,`,
  "a message, a tool's description or a tool's answer), call it with that prefix: send_to_session",
  `is ${qualifiedToolName('send_to_session')}. A call by the plain name runs nothing.`,
  'To the person, name tools plainly, without the prefix.',
].join(' ');

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

  mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
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
      result.content,
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
