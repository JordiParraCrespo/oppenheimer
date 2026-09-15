import { subject as tagSubject } from '@casl/ability';
import type { AppAbility } from '@oppenheimer/shared';

/**
 * Check an action against a **concrete row**, not just its type.
 *
 * `ability.can('update', 'Lead')` answers "may you update leads at all".
 * This answers "may you update *this* lead", which is what evaluates the
 * `conditions` on a permission (own-resource, team, grant scoping).
 *
 * The cast is the one place in the codebase that needs it. CASL parameterizes
 * an ability by its subject *name* union — here free-form `string` — but
 * `can()` also accepts a row tagged by `subject()` at runtime. Widening the
 * type parameter to admit both makes the condition generics collapse to
 * `never`, so the honest trade is a single contained cast behind a named
 * function rather than one at every instance-level check.
 */
export function canAccessRow(
  ability: AppAbility,
  action: string,
  subjectName: string,
  row: Record<string, unknown>,
): boolean {
  return ability.can(action, tagSubject(subjectName, row) as unknown as string);
}
