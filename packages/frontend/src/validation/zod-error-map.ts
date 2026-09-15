import type { ZodErrorMap } from 'zod';

/**
 * Keys {@link createZodErrorMap} resolves. Every locale in `@oppenheimer/translations`
 * must define these, otherwise the apps' typed `t()` will reject the map.
 */
export type ValidationMessageKey =
  | 'validation.required'
  | 'validation.email'
  | 'validation.url'
  | 'validation.minLength'
  | 'validation.maxLength'
  | 'validation.minItems'
  | 'validation.maxItems';

/**
 * Message lookup with interpolation params. Narrower than i18next's `t` on
 * purpose: a `t` typed over the full catalog is assignable to this, so the apps
 * pass theirs straight in and still catch a missing key at compile time.
 */
export type TranslateFn = (key: ValidationMessageKey, params?: Record<string, unknown>) => string;

/**
 * Derives form validation messages from Zod issue codes instead of the literal
 * strings baked into the schemas.
 *
 * The schemas in `@oppenheimer/shared` are shared with the API, so their messages are
 * English and stay that way. Forms need them in the user's language, so we map
 * the issue back onto a `validation.*` translation key at parse time. Anything
 * we don't recognise falls through to Zod's own message, which keeps custom
 * `refine` messages intact.
 */
export function createZodErrorMap(t: TranslateFn): ZodErrorMap {
  return (issue, ctx) => {
    switch (issue.code) {
      case 'invalid_type':
        return issue.received === 'undefined' || issue.received === 'null'
          ? { message: t('validation.required') }
          : { message: ctx.defaultError };

      case 'invalid_string':
        if (issue.validation === 'email') return { message: t('validation.email') };
        if (issue.validation === 'url') return { message: t('validation.url') };
        return { message: ctx.defaultError };

      case 'invalid_union': {
        // Optional URL inputs are represented as `url().or(literal(''))` so
        // an empty control can mean "remove it". Zod reports a failed URL in
        // that union at the union level, so preserve the useful URL message.
        const containsUrlFailure = issue.unionErrors.some((error) =>
          error.issues.some(
            (candidate) => candidate.code === 'invalid_string' && candidate.validation === 'url',
          ),
        );
        return containsUrlFailure
          ? { message: t('validation.url') }
          : { message: ctx.defaultError };
      }

      case 'too_small': {
        const min = Number(issue.minimum);
        if (issue.type === 'string') {
          return min <= 1
            ? { message: t('validation.required') }
            : { message: t('validation.minLength', { min }) };
        }
        if (issue.type === 'array') {
          return { message: t('validation.minItems', { min }) };
        }
        return { message: ctx.defaultError };
      }

      case 'too_big': {
        const max = Number(issue.maximum);
        if (issue.type === 'string') {
          return { message: t('validation.maxLength', { max }) };
        }
        if (issue.type === 'array') {
          return { message: t('validation.maxItems', { max }) };
        }
        return { message: ctx.defaultError };
      }

      default:
        return { message: ctx.defaultError };
    }
  };
}
