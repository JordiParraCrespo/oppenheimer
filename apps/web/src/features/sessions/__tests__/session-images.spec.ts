import { describe, expect, it } from 'vitest';
import { filesIn, imagesIn } from '../lib/session-images';

/** A DataTransfer-shaped object: jsdom's own does not carry files. */
function transfer({
  items = [],
  files = [],
}: {
  items?: { kind: string; type: string; file?: File }[];
  files?: File[];
}): DataTransfer {
  return {
    items: items.map((item) => ({
      kind: item.kind,
      type: item.type,
      getAsFile: () => item.file ?? null,
    })),
    files,
  } as unknown as DataTransfer;
}

const shot = new File([new Uint8Array([0x89, 0x50])], 'shot.png', { type: 'image/png' });
const jpeg = new File([new Uint8Array([0xff, 0xd8])], 'b.jpg', { type: 'image/jpeg' });
const unlabelled = new File([new Uint8Array([0x89, 0x50])], 'Screenshot', { type: '' });
const pdf = new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' });
const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });

describe('imagesIn', () => {
  it('keeps the types an agent reads and unlabelled files, in order, on every gesture', () => {
    expect(imagesIn([shot, pdf, unlabelled, svg, jpeg])).toEqual([shot, unlabelled, jpeg]);
  });

  it('keeps nothing from a drop of files an agent cannot read', () => {
    expect(imagesIn([pdf, svg])).toEqual([]);
  });
});

describe('filesIn', () => {
  it('takes a pasted screenshot from the items, and only the file items', () => {
    const copied = transfer({
      items: [
        { kind: 'string', type: 'text/html' },
        { kind: 'file', type: 'image/png', file: shot },
      ],
    });
    expect(filesIn(copied)).toEqual([shot]);
  });

  it('takes a drop that only the file list names', () => {
    expect(filesIn(transfer({ files: [shot, jpeg] }))).toEqual([shot, jpeg]);
  });

  it('reads nothing from plain text or no transfer', () => {
    expect(filesIn(transfer({ items: [{ kind: 'string', type: 'text/plain' }] }))).toEqual([]);
    expect(filesIn(null)).toEqual([]);
  });
});
