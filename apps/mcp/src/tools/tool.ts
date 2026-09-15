import { hasAllScopes, missingScopes, type Scope } from '@oppenheimer/shared';
import type { z } from 'zod';
import type { OppenheimerClient } from '../client';

/** What a tool handler is given: the API client, and nothing else. */
export interface ToolContext {
  client: OppenheimerClient;
}

/**
 * Hints about a tool's behaviour, passed through to MCP clients so they can
 * decide what needs confirmation. They are advisory: the API enforces the real
 * rules regardless of what a client does with them.
 */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

export interface ToolDefinition<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  /**
   * Permissions a credential must carry for this tool to be offered at all.
   * The same scopes are what the API's `@RequireScopes` demands of the
   * underlying endpoint, so a tool that passes this filter will not be
   * refused for lack of scope later.
   */
  requiredScopes: Scope[];
  /**
   * A Zod object schema, not a raw shape. `2026-07-28` loosened `inputSchema`
   * to any JSON Schema 2020-12 document, and the SDK derives it from the
   * schema's own JSON Schema conversion — so the schema object itself, rather
   * than a shape the SDK would have to wrap, is what it wants.
   */
  inputSchema: Schema;
  annotations?: ToolAnnotations;
  handler: (args: z.output<Schema>, context: ToolContext) => Promise<unknown>;
}

/** Helper that keeps each tool's argument types inferred from its schema. */
export function defineTool<Schema extends z.ZodObject>(
  definition: ToolDefinition<Schema>,
): ToolDefinition<Schema> {
  return definition;
}

/** The tools a credential with these scopes may use. */
export function allowedTools(
  tools: readonly ToolDefinition[],
  scopes: readonly Scope[],
): ToolDefinition[] {
  return tools.filter((tool) => hasAllScopes(scopes, tool.requiredScopes));
}

/** The scopes a tool needs that this credential is missing. */
export function unmetScopes(tool: ToolDefinition, scopes: readonly Scope[]): readonly Scope[] {
  return missingScopes(scopes, tool.requiredScopes);
}
