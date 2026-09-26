import { describe, expect, it } from 'vitest';
import { pasteSessionImageSchema } from '../../schemas/session.schema';
import { SESSION_IMAGE_TYPES, sniffSessionImage } from '../session-image';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

/**
 * The type an image is taken as is what its first bytes say, never what the
 * browser labelled it; the runner compiles the same table.
 */
describe('sniffSessionImage', () => {
  it('reads every type in the table from its magic bytes', () => {
    expect(sniffSessionImage(bytes(0x89, 'PNG\r\n', 0x1a, '\n', 0))).toBe('image/png');
    expect(sniffSessionImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffSessionImage(bytes('GIF89a'))).toBe('image/gif');
    expect(sniffSessionImage(bytes('GIF87a'))).toBe('image/gif');
    expect(sniffSessionImage(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp');
    expect(SESSION_IMAGE_TYPES).toHaveLength(4);
  });

  it('takes nothing else, however it is labelled', () => {
    expect(sniffSessionImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffSessionImage(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
    expect(sniffSessionImage(bytes('GIF89'))).toBeNull();
    expect(sniffSessionImage(new Uint8Array())).toBeNull();
  });
});

describe('the runner image table', () => {
  it('is the committed generation of this one, so the host cannot disagree about what an image is', async () => {
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { outputPath, render } = require('../../../scripts/emit-session-image.cjs');
    expect(readFileSync(outputPath, 'utf8')).toBe(render());
  });
});

describe('pasteSessionImageSchema', () => {
  it('reads the window from a multipart field, and leaves it out when absent', () => {
    expect(pasteSessionImageSchema.parse({ window: '2' })).toEqual({ window: 2 });
    expect(pasteSessionImageSchema.parse({})).toEqual({});
    expect(pasteSessionImageSchema.safeParse({ window: '-1' }).success).toBe(false);
  });
});
