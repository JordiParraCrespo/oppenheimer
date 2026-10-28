import { describe, expect, it } from 'vitest';
import { isoTimeOf, readJsonBlock } from './json-block';

describe('readJsonBlock', () => {
  it('reads a json fence that parses as the value it holds', () => {
    expect(readJsonBlock('{ "a": [1, 2] }', 'json')).toEqual({ value: { a: [1, 2] } });
  });

  it('reads the run of fields an agent pulls out of a larger object as that object', () => {
    const fields = '"startsAt": "2026-11-16T00:00:00.000Z",\n"endsAt": "2026-12-22T23:59:59.000Z"';
    expect(readJsonBlock(fields, 'json')).toEqual({
      value: { startsAt: '2026-11-16T00:00:00.000Z', endsAt: '2026-12-22T23:59:59.000Z' },
    });
    expect(readJsonBlock(`${fields},`, 'json')?.value).toHaveProperty('endsAt');
  });

  it('reads an unlabelled fence only when it parses to an object or an array', () => {
    expect(readJsonBlock('[{"id": 1}]', undefined)).toEqual({ value: [{ id: 1 }] });
    expect(readJsonBlock('42', undefined)).toBeNull();
    expect(readJsonBlock('"a": 1', undefined)).toBeNull();
  });

  it('leaves code in another language, and JSON that does not parse, as code', () => {
    expect(readJsonBlock('{ "a": 1 }', 'ts')).toBeNull();
    expect(readJsonBlock('{ a: 1, // why\n}', 'jsonc')).toBeNull();
    expect(readJsonBlock('"a": 1 }', 'json')).toBeNull();
  });
});

describe('isoTimeOf', () => {
  it('reads an ISO time with its zone, and nothing that only looks like a date', () => {
    expect(isoTimeOf('2026-11-16T00:00:00.000Z')?.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(isoTimeOf('2026-11-16T01:00+01:00')?.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(isoTimeOf('2026-11-16')).toBeNull();
    expect(isoTimeOf('2026-11-16T00:00:00')).toBeNull();
    expect(isoTimeOf(1731715200000)).toBeNull();
  });
});
