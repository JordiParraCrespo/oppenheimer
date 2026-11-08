import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import type { BotToolGroup } from '@oppenheimer/shared/schemas/bot';
import { z } from 'zod';

/** The views over a bot's tools: every tool, one decision, or the ones the owner set. */
export const TOOL_VIEWS = ['all', 'allow', 'ask', 'off', 'changed'] as const;
export type ToolView = (typeof TOOL_VIEWS)[number];

/**
 * Settings → Permissions' search: which view of the tools is on, so a
 * narrowed list is a link. `all` is the default and is written as no key.
 */
export const botPermissionsSearchSchema = z.object({
  tools: z.enum(TOOL_VIEWS).optional().catch(undefined),
});
export type BotPermissionsSearch = z.infer<typeof botPermissionsSearchSchema>;

export interface ToolFilter {
  query: string;
  view: ToolView;
}

export interface ToolGroupSummary {
  total: number;
  ask: number;
  off: number;
  changed: number;
}

function inView(tool: BotToolSetting, view: ToolView): boolean {
  if (view === 'all') return true;
  if (view === 'changed') return tool.set !== null;
  return tool.decision === view;
}

/** A query matches the tool's name (`edit_soul`, `edit soul`) or its description. */
function matchesQuery(tool: BotToolSetting, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const name = tool.name.toLowerCase();
  return (
    name.includes(needle) ||
    name.replaceAll('_', ' ').includes(needle) ||
    tool.description.toLowerCase().includes(needle)
  );
}

export function isFiltering(filter: ToolFilter): boolean {
  return filter.view !== 'all' || filter.query.trim() !== '';
}

/** The groups with the tools the filter leaves; a group left empty is dropped. */
export function filterToolGroups(
  groups: readonly { group: BotToolGroup; tools: BotToolSetting[] }[],
  filter: ToolFilter,
): { group: BotToolGroup; tools: BotToolSetting[] }[] {
  return groups
    .map(({ group, tools }) => ({
      group,
      tools: tools.filter((tool) => inView(tool, filter.view) && matchesQuery(tool, filter.query)),
    }))
    .filter(({ tools }) => tools.length > 0);
}

/** How many tools each view would show under the query, for the tabs' counts. */
export function countToolViews(
  tools: readonly BotToolSetting[],
  query: string,
): Record<ToolView, number> {
  const matching = tools.filter((tool) => matchesQuery(tool, query));
  return Object.fromEntries(
    TOOL_VIEWS.map((view) => [view, matching.filter((tool) => inView(tool, view)).length]),
  ) as Record<ToolView, number>;
}

/** What a folded group says on its right: how many tools, how many ask, are off, were set. */
export function summarizeToolGroup(tools: readonly BotToolSetting[]): ToolGroupSummary {
  return {
    total: tools.length,
    ask: tools.filter((tool) => tool.decision === 'ask').length,
    off: tools.filter((tool) => tool.decision === 'off').length,
    changed: tools.filter((tool) => tool.set !== null).length,
  };
}
