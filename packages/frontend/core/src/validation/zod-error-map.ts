import type { ZodErrorMap, ZodIssueOptionalMessage } from 'zod';

/**
 * Keys {@link createZodErrorMap} resolves. Every locale in `@oppenheimer/translations`
 * must define these, otherwise the apps' typed `t()` will reject the map.
 */
const VALIDATION_MESSAGE_KEYS = [
  'validation.required',
  'validation.invalid',
  'validation.email',
  'validation.url',
  'validation.format',
  'validation.choice',
  'validation.date',
  'validation.minLength',
  'validation.maxLength',
  'validation.minItems',
  'validation.maxItems',
  'validation.min',
  'validation.max',
  'validation.multipleOf',
  'validation.tooLong',
] as const;

export type ValidationMessageKey = (typeof VALIDATION_MESSAGE_KEYS)[number];

/**
 * Message lookup with interpolation params. Narrower than i18next's `t` on
 * purpose: a `t` typed over the full catalog is assignable to this, so the apps
 * pass theirs straight in and still catch a missing key at compile time.
 */
export type TranslateFn = (key: ValidationMessageKey, params?: Record<string, unknown>) => string;

function isValidationMessageKey(value: unknown): value is ValidationMessageKey {
  return (VALIDATION_MESSAGE_KEYS as readonly unknown[]).includes(value);
}

/**
 * Issue codes that say "this was the wrong branch", not "this branch's value
 * is wrong". A union reports one set of issues per branch; these are the
 * branches that never applied.
 */
const WRONG_BRANCH = new Set<string>(['invalid_type', 'invalid_literal']);

/**
 * The schemas in `@oppenheimer/shared` are shared with the API, so they state
 * constraints, not messages. Forms need those constraints worded in the user's
 * language, so every issue code is mapped onto a `validation.*` key at parse
 * time — none falls through to Zod's own English. A check that states its own
 * message still wins (Zod never asks the map), which is why the shared schemas
 * do not.
 *
 * A `refine` has no issue code of its own worth reading (`custom`), so it names
 * its message through its params: `.refine(fn, { params: { i18nKey:
 * 'validation.tooLong' } })`. Other params are interpolated. A `refine` that
 * names none reads as the generic `validation.invalid`.
 */
export function createZodErrorMap(t: TranslateFn): ZodErrorMap {
  return (issue: ZodIssueOptionalMessage) => {
    switch (issue.code) {
      case 'invalid_type':
        return issue.received === 'undefined' || issue.received === 'null'
          ? { message: t('validation.required') }
          : { message: t('validation.invalid') };

      case 'invalid_string':
        if (issue.validation === 'email') return { message: t('validation.email') };
        if (issue.validation === 'url') return { message: t('validation.url') };
        // A regex, a uuid, a datetime, a prefix: the value has the wrong shape.
        return { message: t('validation.format') };

      case 'invalid_union': {
        // An optional field is often `schema.or(z.literal(''))`, so an empty
        // control can mean "none"; a failure then reports at the union, which
        // says nothing. The branch that applied is the one whose issues are
        // about the value rather than about its type — surface its first
        // issue, already worded by this map when Zod raised it.
        const specific = issue.unionErrors
          .flatMap((error) => error.issues)
          .find((candidate) => !WRONG_BRANCH.has(candidate.code));
        return { message: specific?.message ?? t('validation.invalid') };
      }

      case 'invalid_enum_value':
      case 'invalid_union_discriminator':
        return { message: t('validation.choice') };

      case 'invalid_date':
        return { message: t('validation.date') };

      case 'too_small': {
        const min = Number(issue.minimum);
        if (issue.type === 'string') {
          return min <= 1
            ? { message: t('validation.required') }
            : { message: t('validation.minLength', { min }) };
        }
        if (issue.type === 'array' || issue.type === 'set') {
          return { message: t('validation.minItems', { min }) };
        }
        if (issue.type === 'number' || issue.type === 'bigint') {
          return { message: t('validation.min', { min }) };
        }
        return { message: t('validation.invalid') };
      }

      case 'too_big': {
        const max = Number(issue.maximum);
        if (issue.type === 'string') return { message: t('validation.maxLength', { max }) };
        if (issue.type === 'array' || issue.type === 'set') {
          return { message: t('validation.maxItems', { max }) };
        }
        if (issue.type === 'number' || issue.type === 'bigint') {
          return { message: t('validation.max', { max }) };
        }
        return { message: t('validation.invalid') };
      }

      case 'not_multiple_of':
        return { message: t('validation.multipleOf', { step: Number(issue.multipleOf) }) };

      case 'custom': {
        const { i18nKey, ...params } = (issue.params ?? {}) as Record<string, unknown>;
        return isValidationMessageKey(i18nKey)
          ? { message: t(i18nKey, Object.keys(params).length ? params : undefined) }
          : { message: t('validation.invalid') };
      }

      // invalid_literal, unrecognized_keys, invalid_arguments,
      // invalid_return_type, invalid_intersection_types, not_finite: nothing
      // more specific to say to a person filling in a form.
      default:
        return { message: t('validation.invalid') };
    }
  };
}
