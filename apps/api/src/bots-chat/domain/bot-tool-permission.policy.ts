import type {
  BotPermission,
  BotPermissionRuleEffect,
  BotToolDecision,
  BotToolGroup,
} from '@oppenheimer/shared';
import type { BotPermissionRuleEntity } from './bot-permission-rule.entity';
import type { BotToolPermissionEntity, BotToolSubject } from './bot-tool-permission.entity';

/**
 * What a bot's owner set for its tools (`25-bots.md` §5), read once per
 * turn: each tool's decision where one was set, the standing grants for
 * single things, and the plain-language rules.
 */
export interface BotPermissions {
  decisions: ReadonlyMap<string, BotToolDecision>;
  grants: readonly { tool: string; subject: BotToolSubject }[];
  rules: readonly { id: string; effect: BotPermissionRuleEffect; text: string }[];
}

/** A bot nobody has set anything for: every tool follows the preset. */
export const NO_PERMISSIONS: BotPermissions = { decisions: new Map(), grants: [], rules: [] };

export function permissionsOf(
  settings: readonly BotToolPermissionEntity[],
  rules: readonly BotPermissionRuleEntity[],
): BotPermissions {
  const decisions = new Map<string, BotToolDecision>();
  const grants: { tool: string; subject: BotToolSubject }[] = [];
  for (const setting of settings) {
    if (setting.subject) grants.push({ tool: setting.tool, subject: setting.subject });
    else decisions.set(setting.tool, setting.decision);
  }
  return {
    decisions,
    grants,
    rules: rules.map((rule) => ({ id: rule.id, effect: rule.effect, text: rule.text })),
  };
}

/** What the permission layer needs to know of a tool. */
export interface BotToolTraits {
  name: string;
  /** It reaches outside Oppenheimer, so the catalog's default is to ask. */
  asks: boolean;
  /** Every call is decided on its own: no Allow in Settings, no standing grant. */
  perCallOnly: boolean;
  /** It asks under every preset, Full access included (mail sent from the owner's address). */
  always?: boolean;
}

/**
 * What the catalog says for a tool on its own, under the bot's preset: one
 * that reaches outside Oppenheimer asks under Approve for me and runs under
 * Full access; one that always asks does so under both; one that stays
 * inside runs.
 */
export function defaultDecision(tool: BotToolTraits, preset: BotPermission): 'allow' | 'ask' {
  return tool.asks && (tool.always || preset !== 'full') ? 'ask' : 'allow';
}

/**
 * Where a tool stands before any call (`25-bots.md` §5): the owner's
 * decision for it, else the catalog's under the preset. `off` takes the tool
 * away. A per-call tool set to Allow by hand (a row written before it was
 * per call) still asks: nothing makes it standing.
 */
export function toolDecision(
  permissions: BotPermissions,
  tool: BotToolTraits,
  preset: BotPermission,
): BotToolDecision {
  const set = permissions.decisions.get(tool.name);
  if (set === 'off') return 'off';
  if (set === 'ask') return 'ask';
  if (set === 'allow') return tool.perCallOnly ? defaultDecision(tool, preset) : 'allow';
  return defaultDecision(tool, preset);
}

/**
 * The standing grant that covers this call, if one does: a grant for the
 * tool on the very thing the call acts on, kind and key alike. A per-call
 * tool has none.
 */
export function grantFor(
  permissions: BotPermissions,
  tool: BotToolTraits,
  subject: BotToolSubject | null,
): BotToolSubject | null {
  if (!subject || tool.perCallOnly) return null;
  const grant = permissions.grants.find(
    (candidate) =>
      candidate.tool === tool.name &&
      candidate.subject.kind === subject.kind &&
      candidate.subject.key === subject.key,
  );
  return grant ? grant.subject : null;
}

/** Which ways a yes may reach for this tool and call (`BOT_APPROVAL_REACHES`). */
export function reachesFor(
  tool: BotToolTraits,
  subject: BotToolSubject | null,
): ('once' | 'tool' | 'subject')[] {
  if (tool.perCallOnly) return ['once'];
  return subject ? ['once', 'subject', 'tool'] : ['once', 'tool'];
}

/** One tool as Settings → Permissions lists it. */
export interface BotToolRow {
  name: string;
  group: BotToolGroup;
  /** Its description's first sentence: what it does. */
  description: string;
  asks: boolean;
  perCallOnly: boolean;
  /** Where it stands now: the owner's setting, or the preset's default. */
  decision: BotToolDecision;
  /** The owner's setting; null when the tool follows the preset. */
  set: BotToolDecision | null;
}

/** Every tool, as Settings lists it, with where each stands for this bot. */
export function toolRows(
  tools: readonly {
    group: BotToolGroup;
    description: string;
    traits: BotToolTraits;
  }[],
  permissions: BotPermissions,
  preset: BotPermission,
): BotToolRow[] {
  return tools.map(({ group, description, traits }) => ({
    name: traits.name,
    group,
    description: firstSentence(description),
    asks: traits.asks,
    perCallOnly: traits.perCallOnly,
    decision: toolDecision(permissions, traits, preset),
    set: permissions.decisions.get(traits.name) ?? null,
  }));
}

function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/s.exec(text.trim());
  return (match ? match[1] : text).trim();
}

/** Settings → Permissions as one read: the preset, every tool's row, the grants, the rules. */
export interface BotPermissionsView {
  preset: BotPermission;
  rows: BotToolRow[];
  /** Newest first. */
  grants: BotToolPermissionEntity[];
  /** Oldest first. */
  rules: BotPermissionRuleEntity[];
}
