import { automationTools } from './automations.tools';
import { botTools } from './bots.tools';
import { hostTools } from './hosts.tools';
import { sessionTools } from './sessions.tools';
import { taskTools } from './tasks.tools';
import type { ToolDefinition } from './tool';

/**
 * Every tool this server can offer, in one registry.
 *
 * Both entrypoints — stdio and Streamable HTTP — build their tool list from
 * here by filtering on the calling credential's scopes, so a tool is written
 * once and is correctly gated on both transports.
 */
export const ALL_TOOLS: readonly ToolDefinition[] = [
  ...hostTools,
  ...sessionTools,
  ...automationTools,
  ...botTools,
  ...taskTools,
] as ToolDefinition[];

export * from './tool';
