import {
  BOT_TOOL_GROUPS,
  type BotPermission,
  type BotPermissionRuleEffect,
  type BotToolDecision,
  type BotToolGroup,
} from '@oppenheimer/shared/schemas/bot';

/** One tool as Settings → Permissions lists it (`25-bots.md` §5). */
export interface BotToolSetting {
  name: string;
  group: BotToolGroup;
  /** What it does, in a sentence. */
  description: string;
  /** It reaches outside Oppenheimer: under Approve for me it asks by default. */
  asks: boolean;
  /** Every call is its own decision (merging): Allow is not offered. */
  perCallOnly: boolean;
  /** Where it stands now: the owner's setting, or the preset's default. */
  decision: BotToolDecision;
  /** The owner's setting; `null` while it follows the preset. */
  set: BotToolDecision | null;
}

/** A standing yes for one tool on one thing ("Always allow for acme/docs"). */
export interface BotToolGrant {
  id: string;
  tool: string;
  subjectKind: string;
  subjectLabel: string;
  createdAt: Date;
}

/** A plain-language rule a reviewer reads before an asking call. */
export interface BotPermissionRule {
  id: string;
  effect: BotPermissionRuleEffect;
  text: string;
  createdAt: Date;
}

/** A bot's Settings → Permissions: every tool, the standing grants, the rules. */
export class BotPermissionsEntity {
  constructor(
    public readonly preset: BotPermission,
    public readonly tools: readonly BotToolSetting[],
    /** Newest first. */
    public readonly grants: readonly BotToolGrant[],
    /** Oldest first. */
    public readonly rules: readonly BotPermissionRule[],
  ) {}

  /** The tools under their groups, in the catalog's order; a group with no tool is left out. */
  get groups(): { group: BotToolGroup; tools: BotToolSetting[] }[] {
    return BOT_TOOL_GROUPS.map((group) => ({
      group,
      tools: this.tools.filter((tool) => tool.group === group),
    })).filter(({ tools }) => tools.length > 0);
  }

  rulesOf(effect: BotPermissionRuleEffect): BotPermissionRule[] {
    return this.rules.filter((rule) => rule.effect === effect);
  }
}
