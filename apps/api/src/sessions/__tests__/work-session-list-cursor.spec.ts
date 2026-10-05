import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { WorkSessionMapper } from '../work-session.mapper';

const mapper = new WorkSessionMapper();
const ID = 'c9b5d3e1-2f30-4b4c-9d5e-6f708192a3b4';

describe('the session list cursor', () => {
  it('round-trips the key Postgres printed, to the microsecond', () => {
    const cursor = { sort: 'recent' as const, key: '2026-09-28 10:00:00.123456+00', id: ID };
    expect(mapper.fromListCursor(mapper.toListCursor(cursor), 'recent')).toEqual(cursor);
  });

  it('refuses a cursor issued for another sort', () => {
    const text = mapper.toListCursor({ sort: 'name', key: 'bold otter', id: ID });
    expect(() => mapper.fromListCursor(text, 'recent')).toThrow(ArgumentInvalidException);
  });

  it('refuses anything it did not issue', () => {
    for (const text of [
      'not base64 json',
      Buffer.from('{"s":"recent","k":1,"i":"x"}').toString('base64url'),
      Buffer.from(`{"s":"sideways","k":"a","i":"${ID}"}`).toString('base64url'),
      Buffer.from('"recent"').toString('base64url'),
    ]) {
      expect(() => mapper.fromListCursor(text, 'recent')).toThrow(ArgumentInvalidException);
    }
  });

  it('answers the counts in page mode only, and the next cursor in both', () => {
    const next = { sort: 'recent' as const, key: 'k', id: ID };
    expect(
      mapper.toPageMeta({ data: [], limit: 20, total: 41, page: 1, nextCursor: next }),
    ).toEqual({
      limit: 20,
      total: 41,
      page: 1,
      totalPages: 3,
      nextCursor: mapper.toListCursor(next),
    });
    expect(mapper.toPageMeta({ data: [], limit: 20, nextCursor: null })).toEqual({
      limit: 20,
      nextCursor: null,
    });
  });
});
