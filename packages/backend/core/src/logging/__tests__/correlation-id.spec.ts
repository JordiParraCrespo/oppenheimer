import { describe, expect, it } from 'vitest';
import { isValidCorrelationId, resolveCorrelationId } from '../correlation-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveCorrelationId', () => {
  it('keeps a valid client header', () => {
    expect(resolveCorrelationId({ headers: { 'x-correlation-id': 'trace-1:abc.DEF_9' } })).toBe(
      'trace-1:abc.DEF_9',
    );
  });

  it('replaces a header over 64 characters with a UUID', () => {
    const id = resolveCorrelationId({ headers: { 'x-correlation-id': 'a'.repeat(65) } });

    expect(id).toMatch(UUID);
  });

  it('accepts exactly 64 characters', () => {
    const value = 'a'.repeat(64);

    expect(resolveCorrelationId({ headers: { 'x-correlation-id': value } })).toBe(value);
  });

  it('validates only the first value of a repeated header', () => {
    expect(resolveCorrelationId({ headers: { 'x-correlation-id': ['first', 'second'] } })).toBe(
      'first',
    );
    expect(
      resolveCorrelationId({ headers: { 'x-correlation-id': ['bad value', 'second'] } }),
    ).toMatch(UUID);
  });

  it.each(['has space', 'line\nbreak', 'tab\tchar', 'nul\u0000', '', 'semi;colon'])(
    'replaces %j with a UUID',
    (value) => {
      expect(resolveCorrelationId({ headers: { 'x-correlation-id': value } })).toMatch(UUID);
    },
  );

  it('generates a UUID when the header is missing', () => {
    expect(resolveCorrelationId({ headers: {} })).toMatch(UUID);
  });

  it('prefers a valid req.id over the header', () => {
    expect(
      resolveCorrelationId({ id: 'from-pino', headers: { 'x-correlation-id': 'client' } }),
    ).toBe('from-pino');
  });

  it('ignores a req.id that is not a valid id (pino counter, junk)', () => {
    expect(resolveCorrelationId({ id: 42, headers: { 'x-correlation-id': 'client' } })).toBe(
      'client',
    );
    expect(resolveCorrelationId({ id: 'x'.repeat(100), headers: {} })).toMatch(UUID);
  });
});

describe('isValidCorrelationId', () => {
  it('accepts only 1–64 characters of [A-Za-z0-9._:-]', () => {
    expect(isValidCorrelationId('abc-123')).toBe(true);
    expect(isValidCorrelationId('abc/123')).toBe(false);
    expect(isValidCorrelationId(undefined)).toBe(false);
    expect(isValidCorrelationId(7)).toBe(false);
  });
});
