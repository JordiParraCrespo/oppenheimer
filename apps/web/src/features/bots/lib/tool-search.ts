import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** The views over a bot's tools: every tool, one decision, or the ones the owner set. */
export const TOOL_VIEWS = ['all', 'allow', 'ask', 'off', 'changed'] as const;
export type ToolView = (typeof TOOL_VIEWS)[number];

/**
 * Settings → Permissions' search: what the tools are searched for and which
 * view is on, so a narrowed list is a link. No search and `all` are the
 * defaults, written as no key.
 */
export const botPermissionsSearchSchema = z.object({
  q: searchText,
  tools: z.enum(TOOL_VIEWS).optional().catch(undefined),
});
export type BotPermissionsSearch = z.infer<typeof botPermissionsSearchSchema>;
