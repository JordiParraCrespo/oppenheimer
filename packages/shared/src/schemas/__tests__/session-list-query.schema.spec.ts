/**
 * `GET /sessions?resolved=` is read as the literal it is. The console sends
 * `resolved=false` to leave resolved sessions out of its list; read with
 * JavaScript truthiness that is `true`, and the list would hold only them.
 */
import { describe, expect, it } from 'vitest';
import { listSessionsQuerySchema } from '../session.schema.js';

describe('listSessionsQuerySchema', () => {
  it('reads `resolved` as the literal sent, and leaves it unset when absent', () => {
    expect(listSessionsQuerySchema.parse({ resolved: 'false' }).resolved).toBe(false);
    expect(listSessionsQuerySchema.parse({ resolved: 'true' }).resolved).toBe(true);
    expect(listSessionsQuerySchema.parse({}).resolved).toBeUndefined();
    expect(listSessionsQuerySchema.safeParse({ resolved: '0' }).success).toBe(false);
  });
});
