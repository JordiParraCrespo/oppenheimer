import { describe, expect, it } from 'vitest';
import { storableJson, storableText } from '../storable-text';

/**
 * What Postgres refuses in `text` and `jsonb` (issue #728): a NUL, and a
 * UTF-16 surrogate half with no partner. What breaks this: a pair (an emoji)
 * taken apart, or a refused character left in a nested value. That Postgres
 * then stores the result is proven by the bots chat integration suite.
 */
describe('storableText', () => {
  it('drops every NUL', () => {
    expect(storableText('Fac\u0000tura\u0000')).toBe('Factura');
  });

  it('replaces a lone high or low surrogate half, and keeps a whole pair', () => {
    expect(storableText('a\uD800b\uDC00c')).toBe('a�b�c');
    expect(storableText('end\uD83D')).toBe('end�');
    expect(storableText('ok 😀')).toBe('ok 😀');
  });
});

describe('storableJson', () => {
  it('cleans every string in a nested value, keys included, and leaves the rest alone', () => {
    const at = new Date('2026-11-08T10:00:00Z');
    expect(
      storableJson({ 'k\u0000': ['a\u0000', { b: '\uDC00' }], n: 1, ok: true, none: null, at }),
    ).toEqual({ k: ['a', { b: '�' }], n: 1, ok: true, none: null, at });
  });
});
