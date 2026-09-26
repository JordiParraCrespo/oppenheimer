import { describe, expect, it } from 'vitest';
import { drawsOwnFrame } from './frame';

describe('drawsOwnFrame', () => {
  it('is the console frame unless a match on the way down asks for its own', () => {
    expect(drawsOwnFrame([{ staticData: {} }, { staticData: {} }])).toBe(false);
    expect(
      drawsOwnFrame([{ staticData: {} }, { staticData: { frame: 'own' } }, { staticData: {} }]),
    ).toBe(true);
    expect(drawsOwnFrame([{ staticData: { frame: 'console' } }])).toBe(false);
  });
});
