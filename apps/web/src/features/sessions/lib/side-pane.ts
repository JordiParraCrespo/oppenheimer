import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import type { PreviewTab } from './preview-open';

/**
 * What the side pane beside a session holds, one tab each. A terminal is a
 * shell window in this session's tmux session, so the host is its source of
 * truth and its tabs come from the session's window list. The rest are what
 * this reader chose to keep beside this session: another session, a bot's
 * chat, or one of the previews. Those are this device's, like whether the
 * pane is open, so the API never hears of them.
 */
export type SideItem =
  | { kind: 'terminal'; window: number }
  | { kind: 'session'; sessionId: string }
  | { kind: 'bot'; botId: string }
  | { kind: 'preview'; tab: PreviewTab };

/** The items this device keeps for a session: everything but its terminals. */
export type KeptSideItem = Exclude<SideItem, { kind: 'terminal' }>;

/** One string per item, for a tab's key and for the one that is shown. */
export function sideItemKey(item: SideItem): string {
  switch (item.kind) {
    case 'terminal':
      return `terminal:${item.window}`;
    case 'session':
      return `session:${item.sessionId}`;
    case 'bot':
      return `bot:${item.botId}`;
    case 'preview':
      return `preview:${item.tab}`;
  }
}

/**
 * What this device keeps for one session: the items it opened, in the order
 * it opened them, and which tab was shown. `active` null is the launcher.
 */
export interface KeptSidePane {
  items: KeptSideItem[];
  active: string | null;
}

const EMPTY: KeptSidePane = { items: [], active: null };

const keyOf = (sessionId: string) => `oppenheimer.session.side.${sessionId}`;

function isKeptItem(value: unknown): value is KeptSideItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  switch (item.kind) {
    case 'session':
      return typeof item.sessionId === 'string';
    case 'bot':
      return typeof item.botId === 'string';
    case 'preview':
      return item.tab === 'browser' || item.tab === 'simulator' || item.tab === 'desktop';
    default:
      return false;
  }
}

/** Anything unreadable, or storage switched off, is an empty pane on the launcher. */
export function storedSidePane(sessionId: string): KeptSidePane {
  try {
    const raw = window.localStorage.getItem(keyOf(sessionId));
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const { items, active } = parsed as { items?: unknown; active?: unknown };
    return {
      items: Array.isArray(items) ? items.filter(isKeptItem) : [],
      active: typeof active === 'string' ? active : null,
    };
  } catch {
    return EMPTY;
  }
}

export function rememberSidePane(sessionId: string, pane: KeptSidePane) {
  try {
    window.localStorage.setItem(keyOf(sessionId), JSON.stringify(pane));
  } catch {
    // Private browsing or a full quota: the pane holds until the page reloads.
  }
}

/** Open `item`, or show it when it is already open; it becomes the shown tab. */
export function openKept(pane: KeptSidePane, item: KeptSideItem): KeptSidePane {
  const key = sideItemKey(item);
  const open = pane.items.some((one) => sideItemKey(one) === key);
  return { items: open ? pane.items : [...pane.items, item], active: key };
}

/**
 * Drop the tab `key`. When it was the one shown, its neighbour is shown
 * instead (the one after it, else the one before), the way a browser closes
 * a tab; with none left, the launcher.
 */
export function closeTab(order: readonly string[], active: string | null, key: string) {
  if (active !== key) return active;
  const at = order.indexOf(key);
  const rest = order.filter((one) => one !== key);
  return rest[Math.min(at, rest.length - 1)] ?? null;
}

/** Which tab shows: the one chosen while it is still open, else the first; none is the launcher. */
export function shownTab(order: readonly string[], active: string | null): string | null {
  if (active === null) return null;
  return order.includes(active) ? active : (order[0] ?? null);
}

/**
 * The agent a session window runs, read off its name: the runner names a
 * window opened for an agent after the agent's catalog id, and a plain shell
 * `shell`. Anything else (an older runner's name, a window renamed on the
 * host) is a shell too.
 */
export function windowAgent(name: string): Exclude<CodingAgentId, 'shell'> | null {
  if (!isCodingAgentId(name) || name === 'shell') return null;
  return name;
}

/**
 * The agents that may start beside a session whose own agent is
 * `sessionAgent`, out of `offered`: never the blank terminal (that is
 * Terminal), and the session's own agent only when its CLI takes the id of
 * the conversation it starts (Claude Code's `--session-id`). One that does
 * not is found by its folder, so a second copy in the same worktree would be
 * read, and resumed, as the session's; the runner refuses it as well.
 */
export function agentsBeside(
  sessionAgent: string,
  offered: readonly CodingAgentId[],
): Exclude<CodingAgentId, 'shell'>[] {
  return offered.filter(
    (agent): agent is Exclude<CodingAgentId, 'shell'> =>
      agent !== 'shell' &&
      (agent !== sessionAgent || Boolean(CODING_AGENTS[agent].launch.conversation?.create)),
  );
}

/**
 * What a second agent starts with, as the side pane's Agent pick sends it:
 * the agent, its model, effort and permission, and its first task. Null is the CLI's own
 * default, never sent.
 */
export interface SideEngine {
  agent: Exclude<CodingAgentId, 'shell'>;
  model: string | null;
  effort: SessionEffort | null;
  permission: SessionPermission | null;
  /** The agent's first task, as typed; null starts it with none. */
  prompt: string | null;
}
