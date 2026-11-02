import { describe, expect, it } from 'vitest';
import { CursorCodec } from '../paging/cursor-codec';
import { type KeysetOrder, keysetAfter, keysetPage } from '../paging/keyset';

/**
 * Keyset paging and the one cursor codec. The SQL a predicate produces is
 * proven against Postgres where a list adopts it (its repository's
 * integration suite); here, what decides a page boundary and what a client's
 * cursor decodes to, including the two encodings already on the wire.
 */
describe('keysetPage', () => {
  const cursorOf = (row: { at: string; id: string }) => ({ key: row.at, id: row.id });
  const rows = ['a', 'b', 'c'].map((id, index) => ({ at: `2026-01-0${index + 1}`, id }));

  it('answers the first `limit` rows and a cursor after the last when a row is left over', () => {
    expect(keysetPage(rows, 2, cursorOf)).toEqual({
      items: rows.slice(0, 2),
      next: { key: '2026-01-02', id: 'b' },
    });
  });

  it('has no next cursor when the read came back short or exact', () => {
    expect(keysetPage(rows, 3, cursorOf).next).toBeNull();
    expect(keysetPage(rows, 5, cursorOf).next).toBeNull();
    expect(keysetPage([], 5, cursorOf)).toEqual({ items: [], next: null });
  });
});

describe('keysetAfter', () => {
  const order: KeysetOrder = {
    key: '"event"."occurredAt"',
    keyType: 'timestamptz',
    id: '"event"."id"',
    idType: 'bigint',
    direction: 'DESC',
  };

  it('resumes a descending list below the cursor, casting both halves back', () => {
    expect(keysetAfter(order, { key: '2026-01-01 00:00:00.123456+00', id: '42' })).toEqual({
      sql: '("event"."occurredAt", "event"."id") < (CAST(:cursorKey AS timestamptz), CAST(:cursorId AS bigint))',
      params: { cursorKey: '2026-01-01 00:00:00.123456+00', cursorId: '42' },
    });
  });

  it('resumes an ascending list above it, under the parameter names asked for', () => {
    const after = keysetAfter({ ...order, direction: 'ASC' }, { key: 'k', id: '1' }, 'after');

    expect(after.sql).toContain(') > (CAST(:afterKey');
    expect(after.params).toEqual({ afterKey: 'k', afterId: '1' });
  });
});

describe('CursorCodec', () => {
  it('reads back what it wrote', () => {
    const text = CursorCodec.encode({ k: '2026-01-01', i: 'id-1' });

    expect(CursorCodec.decode(text, ['k', 'i'])).toEqual({ k: '2026-01-01', i: 'id-1' });
  });

  it('writes the sessions list’s cursor byte for byte', () => {
    const issued = Buffer.from(
      JSON.stringify({ s: 'recent', k: '2026-01-01 00:00:00+00', i: 'id-1' }),
      'utf8',
    ).toString('base64url');

    expect(CursorCodec.encode({ s: 'recent', k: '2026-01-01 00:00:00+00', i: 'id-1' })).toBe(
      issued,
    );
    expect(CursorCodec.decode(issued, ['s', 'k', 'i'])).toEqual({
      s: 'recent',
      k: '2026-01-01 00:00:00+00',
      i: 'id-1',
    });
  });

  it('reads the host timeline’s `|`-joined cursor positionally', () => {
    const issued = Buffer.from('2026-01-01T00:00:00.000Z|42').toString('base64url');

    expect(CursorCodec.decode(issued, ['at', 'id'])).toEqual({
      at: '2026-01-01T00:00:00.000Z',
      id: '42',
    });
  });

  it.each([
    ['empty', ''],
    ['not JSON', Buffer.from('{oops').toString('base64url')],
    ['a field missing', CursorCodec.encode({ k: 'x' })],
    ['a field not a string', Buffer.from('{"k":"x","i":1}').toString('base64url')],
    ['an array', Buffer.from('["x","y"]').toString('base64url')],
    ['too few parts', Buffer.from('only').toString('base64url')],
    ['an empty part', Buffer.from('x|').toString('base64url')],
  ])('refuses a cursor that is %s', (_, text) => {
    expect(CursorCodec.decode(text, ['k', 'i'])).toBeNull();
  });
});
