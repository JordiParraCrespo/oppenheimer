import { zodResolver } from '@hookform/resolvers/zod';
import { createZodErrorMap } from '@oppenheimer/frontend/validation';
import { useMemo } from 'react';
import type { Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { input, output, ParseParams, ZodType } from 'zod';

/**
 * `zodResolver` wired to the active locale. The schemas in `@oppenheimer/shared` state
 * no messages of their own, so every failure is resolved from its issue code
 * into the user's language.
 */
export function useZodResolver<TSchema extends ZodType>(
  schema: TSchema,
): Resolver<input<TSchema>, unknown, output<TSchema>> {
  const { t } = useTranslation();

  return useMemo(() => {
    // `zodResolver` types its second argument as the full `ParseParams`, but
    // forwards it to `safeParse`, which reads the keys it is given.
    const parseOptions = { errorMap: createZodErrorMap(t) } as ParseParams;

    return zodResolver(schema, parseOptions) as Resolver<input<TSchema>, unknown, output<TSchema>>;
  }, [schema, t]);
}
