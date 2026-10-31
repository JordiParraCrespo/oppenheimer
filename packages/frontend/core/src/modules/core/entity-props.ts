/**
 * An entity's fields from its props, the way positional parameters with
 * defaults behaved: a prop that is `undefined` (a field the API left out)
 * keeps the field's default instead of overwriting it.
 *
 * ```ts
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
export function assignProps(entity: object, props: object): void {
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) Reflect.set(entity, key, value);
  }
}
