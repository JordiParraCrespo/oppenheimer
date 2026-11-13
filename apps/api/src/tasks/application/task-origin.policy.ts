import type { TaskOrigin } from '@oppenheimer/shared';
import type { ScopeContext } from '../../auth/domain/scope-context.types';

/**
 * Who a request to Plan comes from (`product/versions/mvp/29-inbox.md`, "Tasks
 * an agent made"): a browser session is the person at the console; any other
 * credential (an API token, an OAuth grant: the MCP server, the CLI, a script)
 * is an agent working for them. A bot's plan tools say `agent` themselves.
 */
export function taskOriginOf(credential: ScopeContext | null): TaskOrigin {
  return credential ? 'agent' : 'person';
}
