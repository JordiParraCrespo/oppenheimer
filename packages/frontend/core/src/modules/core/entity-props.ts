/**
 * An entity's fields from its props, the way positional parameters with
 * defaults behaved: a prop that is `undefined` (a field the API left out)
 * keeps the field's default instead of overwriting it.
 *
 * The contract is the entity's props type, a `Pick` of its own fields: the
 * fields declared with `!` are required there, so a caller that leaves one
 * out does not compile, and only the fields with a default are `Partial`.
 * The entity must itself satisfy its props type, so a prop cannot name a
 * field the entity lacks or give it another type; a prop that names a getter
 * is refused at run time rather than skipped.
 *
 * It is for the wide entities, where positional parameters of the same type
 * can swap places unnoticed (`SessionEntity`, `PullRequestEntity`,
 * `PullRequestDetailEntity`, `AutomationRunEntity`). A small entity keeps
 * its positional constructor.
 *
 * ```ts
 * export type ThingEntityProps = Pick<ThingEntity, 'id'> &
 *   Partial<Pick<ThingEntity, 'tags'>>;
 *
 * export class ThingEntity {
 *   readonly id!: string;
 *   readonly tags: string[] = [];
 *
 *   constructor(props: ThingEntityProps) {
 *     assignProps(this, props);
 *   }
 * }
 * ```
 */
export function assignProps<TProps extends object>(entity: NoInfer<TProps>, props: TProps): void {
  const fields = entity as Record<string, unknown>;
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) fields[key] = value;
  }
}
