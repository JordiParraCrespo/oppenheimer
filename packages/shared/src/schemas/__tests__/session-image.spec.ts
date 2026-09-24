import { describe, expect, it } from 'vitest';
import { pasteSessionImageSchema, sniffSessionImage } from '../session.schema';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

/**
 * The type an image is taken as is what its first bytes say, never what the
 * browser labelled it — the runner holds the same rule in Go.
 */
describe('sniffSessionImage', () => {
  it('reads the four types an agent takes from their magic bytes', () => {
    expect(sniffSessionImage(bytes(0x89, 'PNG\r\n', 0x1a, '\n', 0))).toBe('image/png');
    expect(sniffSessionImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffSessionImage(bytes('GIF89a'))).toBe('image/gif');
    expect(sniffSessionImage(bytes('GIF87a'))).toBe('image/gif');
    expect(sniffSessionImage(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp');
  });

  it('takes nothing else, however it is labelled', () => {
    expect(sniffSessionImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffSessionImage(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
    expect(sniffSessionImage(bytes('GIF89'))).toBeNull();
    expect(sniffSessionImage(new Uint8Array())).toBeNull();
  });
});

describe('pasteSessionImageSchema', () => {
  it('reads the window from a multipart field, and leaves it out when absent', () => {
    expect(pasteSessionImageSchema.parse({ window: '2' })).toEqual({ window: 2 });
    expect(pasteSessionImageSchema.parse({})).toEqual({});
    expect(pasteSessionImageSchema.safeParse({ window: '-1' }).success).toBe(false);
  });
});
