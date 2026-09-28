import { loginSchema, promptSchema } from '@oppenheimer/shared';
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

  it('keeps a message a refine states explicitly', () => {
    const schema = z.string().refine(() => false, 'Must be an IPv4/IPv6 address or CIDR block');
    expect(messageFor(schema, 'junk')).toBe('Must be an IPv4/IPv6 address or CIDR block');
  });

  it('does not claim a type mismatch is a missing field', () => {
    expect(messageFor(z.object({ count: z.number() }), { count: 'ten' })).not.toBe(
      'validation.required',
    );
  });

  it('reports a type mismatch as invalid', () => {
    expect(messageFor(z.number(), 'ten')).toBe('validation.invalid');
  });

  it('translates a pattern and every other string shape as a format failure', () => {
    expect(messageFor(z.string().regex(/^[a-z]+$/), 'A1')).toBe('validation.format');
    expect(messageFor(z.string().uuid(), 'nope')).toBe('validation.format');
    expect(messageFor(z.string().startsWith('ghp_'), 'x')).toBe('validation.format');
  });

  it('surfaces the branch that applied in a union, not the union', () => {
    const optionalUsername = z.union([
      z.literal(''),
      z
        .string()
        .max(3)
        .regex(/^[a-z]+$/),
    ]);

    expect(messageFor(optionalUsername, '')).toBeUndefined();
    expect(messageFor(optionalUsername, 'AB')).toBe('validation.format');
    expect(messageFor(optionalUsername, 'abcd')).toBe('validation.maxLength({"max":3})');
  });

  it('falls back to invalid for a union no branch of which applied', () => {
    expect(messageFor(z.union([z.string(), z.number()]), true)).toBe('validation.invalid');
  });

  it('asks for a choice on an enum or a discriminated union', () => {
    expect(messageFor(z.enum(['a', 'b']), 'c')).toBe('validation.choice');
    const shape = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('a') }),
      z.object({ kind: z.literal('b') }),
    ]);
    expect(messageFor(shape, { kind: 'c' })).toBe('validation.choice');
  });

  it('translates dates and numeric bounds', () => {
    expect(messageFor(z.date(), new Date('nope'))).toBe('validation.date');
    expect(messageFor(z.number().min(2), 1)).toBe('validation.min({"min":2})');
    expect(messageFor(z.number().max(2), 3)).toBe('validation.max({"max":2})');
    expect(messageFor(z.number().multipleOf(5), 7)).toBe('validation.multipleOf({"step":5})');
    expect(messageFor(z.number().finite(), Number.POSITIVE_INFINITY)).toBe('validation.invalid');
  });

  it('translates set bounds as item counts', () => {
    expect(messageFor(z.set(z.string()).min(1), new Set())).toBe('validation.minItems({"min":1})');
  });

  it('reads a literal, unknown keys and an intersection as invalid', () => {
    expect(messageFor(z.literal('yes'), 'no')).toBe('validation.invalid');
    expect(messageFor(z.object({}).strict(), { extra: 1 })).toBe('validation.invalid');
    const both = z.intersection(
      z.literal('a'),
      z.literal('a').transform(() => 'b'),
    );
    expect(messageFor(both, 'a')).toBe('validation.invalid');
  });

  it('words a refine by the key its params name, with the rest interpolated', () => {
    const named = z.string().refine(() => false, { params: { i18nKey: 'validation.tooLong' } });
    const withParams = z
      .string()
      .refine(() => false, { params: { i18nKey: 'validation.maxLength', max: 4 } });

    expect(messageFor(named, 'x')).toBe('validation.tooLong');
    expect(messageFor(withParams, 'x')).toBe('validation.maxLength({"max":4})');
  });

  it('reads a refine that names no key, or an unknown one, as invalid', () => {
    expect(
      messageFor(
        z.string().refine(() => false),
        'x',
      ),
    ).toBe('validation.invalid');
    const unknown = z.string().refine(() => false, { params: { i18nKey: 'nav.home' } });
    expect(messageFor(unknown, 'x')).toBe('validation.invalid');
  });

  it("translates the shared prompt's byte cap", () => {
    // Four bytes per emoji: under the character cap, over the byte one.
    expect(messageFor(promptSchema, '😀'.repeat(600))).toBe('validation.tooLong');
  });
});
