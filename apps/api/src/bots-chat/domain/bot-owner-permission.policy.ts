import { PERMISSION_GROUPS, type Scope } from '@oppenheimer/shared';

/**
 * A bot acts as its owner, so it does nothing its owner's roles do not allow
 * (`25-bots.md` §4): a tool whose scope the owner could not grant a token is
 * refused before it runs or raises a card. The tool stays offered, so the
 * bot can say what is missing instead of not knowing the tool exists. Pure.
 */

/** What the model reads when the owner's roles do not cover a tool: nothing ran, and why. */
export function ownerLacksPermission(tool: string, scope: Scope): string {
  return `Not run: ${tool} needs the "${permissionName(scope)}" permission (${scope}), and the person you act for does not have it in this workspace. Nothing was done. Tell them they need that permission granted to them by whoever manages roles in the workspace, and that you can do it once it is. Do not try to do it another way, and do not call ${tool} again in this turn.`;
}

/** Every scope as the permission picker names it, read once from the catalog. */
const PERMISSION_NAMES: ReadonlyMap<Scope, string> = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    Object.values(group.levels).map((level) => [level.scope, `${group.label}: ${level.label}`]),
  ),
);

/** A scope as the permission picker names it: "Pull requests: Review". */
export function permissionName(scope: Scope): string {
  return PERMISSION_NAMES.get(scope) ?? scope;
}
