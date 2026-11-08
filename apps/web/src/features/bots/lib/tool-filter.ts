import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import type { BotToolGroup } from '@oppenheimer/shared/schemas/bot';
import { TOOL_VIEWS, type ToolView } from './tool-search';

export interface ToolFilter {
  query: string;
  view: ToolView;
  /** A group to keep alone, or `all`; a name the catalog does not have keeps every group. */
  group: string;
}

export interface ToolGroupSummary {
  total: number;
  ask: number;
  off: number;
  changed: number;
}

type ToolGroups = readonly { group: BotToolGroup; tools: BotToolSetting[] }[];

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

/** The group the filter keeps, or `all` when it names none the bot has. */
export function pickedGroup(groups: ToolGroups, group: string): BotToolGroup | 'all' {
  return groups.find((entry) => entry.group === group)?.group ?? 'all';
}

export function isFiltering(groups: ToolGroups, filter: ToolFilter): boolean {
  return (
    filter.view !== 'all' ||
    filter.query.trim() !== '' ||
    pickedGroup(groups, filter.group) !== 'all'
  );
}

/** The groups with the tools the filter leaves; a group left empty is dropped. */
export function filterToolGroups(
  groups: ToolGroups,
  filter: ToolFilter,
): { group: BotToolGroup; tools: BotToolSetting[] }[] {
  const only = pickedGroup(groups, filter.group);
  return groups
    .filter(({ group }) => only === 'all' || group === only)
    .map(({ group, tools }) => ({
      group,
      tools: tools.filter((tool) => inView(tool, filter.view) && matchesQuery(tool, filter.query)),
    }))
    .filter(({ tools }) => tools.length > 0);
}

/** How many tools each decision would leave, under the search and the group. */
export function countToolViews(groups: ToolGroups, filter: ToolFilter): Record<ToolView, number> {
  const tools = filterToolGroups(groups, { ...filter, view: 'all' }).flatMap(({ tools }) => tools);
  return Object.fromEntries(
    TOOL_VIEWS.map((view) => [view, tools.filter((tool) => inView(tool, view)).length]),
  ) as Record<ToolView, number>;
}

/** How many tools each group would leave, under the search and the decision; `all` is their sum. */
export function countToolGroups(groups: ToolGroups, filter: ToolFilter): Record<string, number> {
  const left = filterToolGroups(groups, { ...filter, group: 'all' });
  const counts: Record<string, number> = { all: 0 };
  for (const { group } of groups) counts[group] = 0;
  for (const { group, tools } of left) {
    counts[group] = tools.length;
    counts.all = (counts.all ?? 0) + tools.length;
  }
  return counts;
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
