import { adminTools } from './admin.tools';
import { organizationTools } from './organizations.tools';
import { roleTools } from './roles.tools';
import type { ToolDefinition } from './tool';
import { userTools } from './users.tools';
import { workspaceTools } from './workspaces.tools';

/**
 * Every tool this server can offer, in one registry.
 *
 * Both entrypoints — stdio and Streamable HTTP — build their tool list from
 * here by filtering on the calling credential's scopes, so a tool is written
 * once and is correctly gated on both transports.
 */
export const ALL_TOOLS: readonly ToolDefinition[] = [
  ...userTools,
  ...roleTools,
  ...organizationTools,
  ...workspaceTools,
  ...adminTools,
] as ToolDefinition[];

export * from './tool';
