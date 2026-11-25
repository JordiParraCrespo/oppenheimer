import { zodResolver } from '@hookform/resolvers/zod';
import { createZodErrorMap } from '@oppenheimer/frontend-core/validation';
import type { Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { input, output, ParseParams, ZodType } from 'zod';

/**
 * `zodResolver` wired to the active locale. The schemas in `@oppenheimer/shared` state
 * no messages of their own, so every failure is resolved from its issue code
 * into the user's language.
 *
 * Built on every render, on purpose: React Hook Form reads `resolver` from its
 * options at validation time and needs no stable identity for it, and a
 * resolver is one small closure — a manual `useMemo` here would be the kind
 * the render rules say not to write.
 */
export function useZodResolver<TSchema extends ZodType>(
  schema: TSchema,
): Resolver<input<TSchema>, unknown, output<TSchema>> {
  const { t } = useTranslation();

  // Both casts are the resolver's typings, not ours: its Zod 3 overload wants
  // the *full* `ParseParams` (it forwards them to `safeParse`, which reads the
  // keys it is given), and infers `Input` from `FieldValues` rather than from
  // the schema, so the return type has to be named here.
  const parseOptions = { errorMap: createZodErrorMap(t) } as ParseParams;

  return zodResolver(schema, parseOptions) as Resolver<input<TSchema>, unknown, output<TSchema>>;
}
