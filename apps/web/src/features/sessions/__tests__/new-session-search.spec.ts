import { describe, expect, it } from 'vitest';
import { newSessionSearchSchema } from '../lib/new-session-search';

/** "New session here" and Add a host land on New session with the chip to start on. */
describe('newSessionSearchSchema', () => {
  it('keeps the project and host to start the chips on', () => {
    expect(newSessionSearchSchema.parse({ project: 'p1', host: 'h1' })).toEqual({
      project: 'p1',
      host: 'h1',
    });
  });

  it('reads an empty or malformed value as absent rather than failing the route', () => {
    expect(newSessionSearchSchema.parse({ project: '', host: 7 })).toEqual({
      project: undefined,
      host: undefined,
    });
  });
});
