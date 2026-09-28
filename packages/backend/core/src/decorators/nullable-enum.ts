import type { ApiPropertyOptions } from '@nestjs/swagger';

/**
 * The Swagger options for an enum property that may also be `null`.
 *
 * OpenAPI 3.0 reads `enum` as the complete list of allowed values, so
 * `{ enum: [...], nullable: true }` alone still forbids `null`, and a client
 * generated from it drops the `null` from the type. Listing it in the enum
 * says what the property holds. A fresh array, so the catalog passed in is
 * never the one the document holds.
 *
 * ```ts
 * @ApiPropertyOptional({ ...nullableEnum(CODING_AGENT_IDS), description: '…' })
 * ```
 */
export function nullableEnum(
  values: readonly string[],
): Pick<ApiPropertyOptions, 'enum' | 'nullable'> {
  // Swagger's enum type has no `null` member; the value it emits is exactly this array.
  return { enum: [...values, null] as string[], nullable: true };
}
