import { describe, expect, it } from 'vitest';
import { carriesFiles, imageFromTransfer } from '../lib/terminal-images';

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

describe('carriesFiles', () => {
  it('is true only for a drag with files', () => {
    expect(carriesFiles(transfer({ types: ['Files'] }))).toBe(true);
    expect(carriesFiles(transfer({ types: ['text/plain'] }))).toBe(false);
    expect(carriesFiles(null)).toBe(false);
  });
});
