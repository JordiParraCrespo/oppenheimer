import { describe, expect, it } from 'vitest';
import { imageFromTransfer, imagesIn } from '../lib/terminal-images';

/** A DataTransfer-shaped object: jsdom's own does not carry files. */
function transfer({
  items = [],
  files = [],
  types = [],
}: {
  items?: { kind: string; type: string; file?: File }[];
  files?: File[];
  types?: string[];
}): DataTransfer {
  return {
    items: items.map((item) => ({
      kind: item.kind,
      type: item.type,
      getAsFile: () => item.file ?? null,
    })),
    files,
    types,
  } as unknown as DataTransfer;
}

const shot = new File([new Uint8Array([0x89, 0x50])], 'shot.png', { type: 'image/png' });

describe('imageFromTransfer', () => {
  it('takes a pasted screenshot', () => {
    expect(
      imageFromTransfer(transfer({ items: [{ kind: 'file', type: 'image/png', file: shot }] })),
    ).toBe(shot);
  });

  it('takes the image over the text copied with it', () => {
    const copied = transfer({
      items: [
        { kind: 'string', type: 'text/html' },
        { kind: 'file', type: 'image/png', file: shot },
      ],
    });
    expect(imageFromTransfer(copied)).toBe(shot);
  });

  it('takes a dropped file that only the file list names', () => {
    expect(imageFromTransfer(transfer({ files: [shot] }))).toBe(shot);
  });

  it('leaves plain text, and files an agent cannot read, to the terminal', () => {
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    expect(
      imageFromTransfer(transfer({ items: [{ kind: 'string', type: 'text/plain' }] })),
    ).toBeNull();
    expect(imageFromTransfer(transfer({ files: [svg] }))).toBeNull();
    expect(imageFromTransfer(null)).toBeNull();
  });
});

describe('imagesIn', () => {
  it('keeps the dropped images an agent can read, in order, and nothing else', () => {
    const pdf = new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' });
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    const jpeg = new File([new Uint8Array([0xff, 0xd8])], 'b.jpg', { type: 'image/jpeg' });
    expect(imagesIn([shot, pdf, svg, jpeg])).toEqual([shot, jpeg]);
    expect(imagesIn([pdf])).toEqual([]);
  });
});
