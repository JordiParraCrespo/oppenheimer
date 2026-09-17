import { loginSchema } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createZodErrorMap, type TranslateFn } from '../zod-error-map';

/** Echoes the key and any params, so assertions show what was resolved. */
const translate: TranslateFn = (key, params) =>
  params ? `${key}(${JSON.stringify(params)})` : key;

const errorMap = createZodErrorMap(translate);

/** First message Zod produces for `value`, parsed through the map. */
function messageFor(schema: z.ZodTypeAny, value: unknown): string | undefined {
  const result = schema.safeParse(value, { errorMap });
  return result.success ? undefined : result.error.errors[0]?.message;
}

describe('createZodErrorMap', () => {
  it('reports a missing field as required', () => {
    expect(messageFor(z.object({ email: z.string() }), {})).toBe('validation.required');
  });

  it('reports an empty string as required rather than a length failure', () => {
    expect(messageFor(z.string().min(1), '')).toBe('validation.required');
  });

  it('passes the bound along for a real length failure', () => {
    expect(messageFor(z.string().min(8), 'short')).toBe('validation.minLength({"min":8})');
    expect(messageFor(z.string().max(80), 'x'.repeat(81))).toBe('validation.maxLength({"max":80})');
  });

  it('translates a rejected email', () => {
    expect(messageFor(z.string().email(), 'nope')).toBe('validation.email');
  });

  it('translates a rejected optional URL', () => {
    const optionalUrl = z.string().url().or(z.literal(''));

    expect(messageFor(optionalUrl, '')).toBeUndefined();
    expect(messageFor(optionalUrl, 'not-a-url')).toBe('validation.url');
  });

  it('cannot override a message the schema states explicitly', () => {
    // Zod short-circuits the error map when the check carries its own message.
    // This is why the schemas in `@oppenheimer/shared` deliberately omit them.
    expect(messageFor(z.string().email('Invalid email address'), 'nope')).toBe(
      'Invalid email address',
    );
  });

  it('translates every failure of the real login schema', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: 'short' }, { errorMap });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.errors.map((issue) => issue.message)).toEqual([
      'validation.email',
      'validation.minLength({"min":8})',
    ]);
  });

  it('handles array bounds', () => {
    expect(messageFor(z.array(z.string()).min(1), [])).toBe('validation.minItems({"min":1})');
    expect(messageFor(z.array(z.string()).max(2), ['a', 'b', 'c'])).toBe(
      'validation.maxItems({"max":2})',
    );
  });

  it('leaves messages it does not recognise to Zod', () => {
    const schema = z.string().refine(() => false, 'Must be an IPv4/IPv6 address or CIDR block');
    expect(messageFor(schema, 'junk')).toBe('Must be an IPv4/IPv6 address or CIDR block');
  });

  it('does not claim a type mismatch is a missing field', () => {
    expect(messageFor(z.object({ count: z.number() }), { count: 'ten' })).not.toBe(
      'validation.required',
    );
  });
});
