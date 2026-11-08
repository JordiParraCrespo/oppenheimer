import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** The decisions a bot's tools are narrowed to: every tool, one decision, or the ones the owner set. */
export const TOOL_VIEWS = ['all', 'allow', 'ask', 'off', 'changed'] as const;
export type ToolView = (typeof TOOL_VIEWS)[number];

/**
 * Settings → Permissions' search: the words, the decision and the group the
 * tools are narrowed to, so a narrowed list is a link. Each default is
 * written as no key. The group is read as text and matched against the
 * catalog by the filter, which keeps the tool catalog out of the first load.
 */
export const botPermissionsSearchSchema = z.object({
  q: searchText,
  decision: z.enum(TOOL_VIEWS).optional().catch(undefined),
  group: searchText,
});
export type BotPermissionsSearch = z.infer<typeof botPermissionsSearchSchema>;
