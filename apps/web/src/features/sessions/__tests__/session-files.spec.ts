import { describe, expect, it } from 'vitest';
import { filesIn, sessionFilesIn } from '../lib/session-files';

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
const notes = new File(['# Notes'], 'notes.md', { type: 'text/markdown' });
const csv = new File(['a,b'], 'data.csv', { type: 'text/csv; charset=utf-8' });
// What Chrome labels a TypeScript file.
const typescript = new File(['export {};'], 'a.ts', { type: 'video/mp2t' });
const html = new File(['<p>'], 'a.html', { type: 'text/html' });
const zip = new File(['PK'], 'a.zip', { type: 'application/zip' });
const video = new File([''], 'a.mp4', { type: 'video/mp4' });
const binary = new File([''], 'a.exe', { type: 'application/x-msdownload' });

describe('sessionFilesIn', () => {
  it('keeps images, PDF, text and unlabelled files, in order, on every gesture', () => {
    expect(sessionFilesIn([shot, pdf, unlabelled, svg, jpeg, notes, csv, typescript])).toEqual([
      shot,
      pdf,
      unlabelled,
      jpeg,
      notes,
      csv,
      typescript,
    ]);
  });

  it('sends a source file the OS labelled oddly, on the name the picker offered', () => {
    const ruby = new File(['puts 1'], 'a.rb', { type: 'application/x-ruby' });
    const toml = new File(['a = 1'], 'Cargo.toml', { type: 'application/octet-stream' });
    expect(sessionFilesIn([ruby, toml])).toEqual([ruby, toml]);
  });

  it('says no at once to what a session never takes, whatever the API would say of the bytes', () => {
    expect(sessionFilesIn([svg, html, zip, video, binary])).toEqual([]);
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
