import { PERMISSION_GROUPS, type Scope } from '@oppenheimer/shared';
import { promptText } from './bot-prompt-text.policy';

/**
 * A bot acts as its owner, so it does nothing its owner's roles do not allow: a
 * tool whose scope the owner could not grant a token is
 * refused before it runs or raises a card. The tool stays offered, so the
 * bot can say what is missing instead of not knowing the tool exists. Pure.
 */

/** What the model reads when the owner's roles do not cover a tool: nothing ran, and why. */
export function ownerLacksPermission(tool: string, scope: Scope): string {
  return promptText('core/tools-permissions.owner-lacks-permission', {
    tool,
    permissionName: permissionName(scope),
    scope,
  });
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
