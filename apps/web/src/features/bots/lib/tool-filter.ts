import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import type { BotToolGroup } from '@oppenheimer/shared/schemas/bot';
import type { ToolView } from './tool-search';

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

/** What the tools section draws for a filter: the groups left, and each dropdown's counts. */
export interface ToolList {
  groups: { group: BotToolGroup; tools: BotToolSetting[] }[];
  /** How many tools each decision would leave, under the search and the group. */
  views: Record<ToolView, number>;
  /** How many tools each group would leave, under the search and the decision; `all` is their sum. */
  groupCounts: Record<string, number>;
  /** Whether anything narrows the list. */
  filtering: boolean;
  /** The group the filter keeps, or `all` when it names none the bot has. */
  group: BotToolGroup | 'all';
}

function inView(tool: BotToolSetting, view: ToolView): boolean {
  if (view === 'all') return true;
  if (view === 'changed') return tool.set !== null;
  return tool.decision === view;
}

/** A query matches the tool's name (`edit_soul`, `edit soul`) or its description. */
function matchesQuery(tool: BotToolSetting, needle: string): boolean {
  if (!needle) return true;
  const name = tool.name.toLowerCase();
  return (
    name.includes(needle) ||
    name.replaceAll('_', ' ').includes(needle) ||
    tool.description.toLowerCase().includes(needle)
  );
}

/**
 * One pass over the catalog: a tool that matches the search counts toward a
 * decision when it is in the picked group, toward a group when it has the
 * picked decision, and is shown when it is both. So each count is the size
 * of the list that option would draw.
 */
export function deriveToolList(all: ToolGroups, filter: ToolFilter): ToolList {
  const needle = filter.query.trim().toLowerCase();
  const only = all.find((entry) => entry.group === filter.group)?.group ?? 'all';
  const views: Record<ToolView, number> = { all: 0, allow: 0, ask: 0, off: 0, changed: 0 };
  const groupCounts: Record<string, number> = { all: 0 };
  const groups: ToolList['groups'] = [];

  for (const { group, tools } of all) {
    const inGroup = only === 'all' || group === only;
    const kept: BotToolSetting[] = [];
    let decided = 0;
    for (const tool of tools) {
      if (!matchesQuery(tool, needle)) continue;
      const decision = inView(tool, filter.view);
      if (inGroup) {
        views.all += 1;
        views[tool.decision] += 1;
        if (tool.set !== null) views.changed += 1;
      }
      if (decision) decided += 1;
      if (inGroup && decision) kept.push(tool);
    }
    groupCounts[group] = decided;
    groupCounts.all = (groupCounts.all ?? 0) + decided;
    if (kept.length > 0) groups.push({ group, tools: kept });
  }

  return {
    groups,
    views,
    groupCounts,
    filtering: needle !== '' || filter.view !== 'all' || only !== 'all',
    group: only,
  };
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
