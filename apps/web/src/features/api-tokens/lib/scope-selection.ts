import type { PermissionGroup, Scope, ScopeAccessLevel } from '@oppenheimer/shared';

/** The resources the scope catalog groups permissions by. */
export type ScopeResource = PermissionGroup['resource'];

/**
 * What one resource is granted. `none` means the group is not granted at all.
 *
 * Edit implies Read, so the three are mutually exclusive rather than a pair of
 * checkboxes — that keeps "what did I just grant" unambiguous. Named for what
 * it is rather than `Selection`, which is a DOM global and would read in this
 * codebase like the set of ticked table rows.
 */
export type ScopeLevel = ScopeAccessLevel | 'none';

/**
 * The form's permission value: one level per resource.
 *
 * It used to be the flat `Scope[]` the API takes, which made the whole picker
 * one controlled value — eleven groups and thirty-three toggles re-rendering
 * because one of them changed. Keyed by resource, each row is its own field and
 * a click costs one row. The flattening happens once, on submit.
 *
 * Partial because a row that has never been touched has granted nothing and
 * never registers a value; a missing key and `'none'` mean the same thing.
 */
export type ScopeSelection = Partial<Record<ScopeResource, ScopeLevel>>;

/** What the API takes: the scope behind each group that is set to something. */
export function scopesFromSelection(
  groups: readonly PermissionGroup[],
  selection: ScopeSelection,
): Scope[] {
  return groups.flatMap((group) => {
    const level = selection[group.resource];
    return level && level !== 'none' ? [group.levels[level].scope] : [];
  });
}

/**
 * Whether anything at all is granted. A token with no scopes can call nothing.
 *
 * `undefined` counts as nothing, and that is not pedantry: a row registers its
 * field on mount without a value, so an untouched picker reads back as eleven
 * keys holding `undefined`. Testing `!== 'none'` alone called that fully
 * granted and waved an empty token straight through.
 */
export function hasAnyScope(selection: ScopeSelection): boolean {
  return Object.values(selection).some((level) => level !== undefined && level !== 'none');
}
