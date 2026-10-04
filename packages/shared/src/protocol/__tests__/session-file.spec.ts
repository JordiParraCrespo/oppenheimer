import { describe, expect, it } from 'vitest';
import { pasteSessionImageSchema } from '../../schemas/session.schema.js';
import { helloSchema, knownCapabilities } from '../messages.js';
import { missingFileCapability } from '../runner-files.js';
import {
  isSessionImageType,
  SESSION_FILE_TYPES,
  SESSION_IMAGE_MEDIA_TYPES,
  sessionFileIs,
  sessionFileOffered,
  sniffSessionFile,
} from '../session-file.js';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

/**
 * The type a file is taken as is what its bytes say, never what the browser
 * labelled it; the runner compiles the same table.
 */
describe('sniffSessionFile', () => {
  it('reads every binary type in the table from its magic bytes', () => {
    expect(sniffSessionFile(bytes(0x89, 'PNG\r\n', 0x1a, '\n', 0))).toBe('image/png');
    expect(sniffSessionFile(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffSessionFile(bytes('GIF89a'))).toBe('image/gif');
    expect(sniffSessionFile(bytes('GIF87a'))).toBe('image/gif');
    expect(sniffSessionFile(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp');
    expect(sniffSessionFile(bytes('%PDF-1.7\n', 0xe2, 0xe3, 0xcf, 0xd3))).toBe('application/pdf');
    expect(SESSION_FILE_TYPES.map((t) => t.mediaType)).toEqual([
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/pdf',
    ]);
  });

  it('takes UTF-8 text, saved as the text type its label or name picks and plain otherwise', () => {
    // "Café ✓", in UTF-8.
    const notes = bytes('# Notes\n\nCaf', 0xc3, 0xa9, ' ', 0xe2, 0x9c, 0x93, '\r\n\tindented\f');
    expect(sniffSessionFile(notes)).toBe('text/plain');
    expect(sniffSessionFile(notes, { fileName: 'NOTES.md' })).toBe('text/markdown');
    expect(sniffSessionFile(bytes('a,b\n1,2'), { mediaType: 'text/csv' })).toBe('text/csv');
    expect(
      sniffSessionFile(bytes('{"a":1}'), { mediaType: 'application/json; charset=utf-8' }),
    ).toBe('application/json');
    // A browser labels a .ts file as an MPEG stream; text is text.
    expect(
      sniffSessionFile(bytes('export {};\n'), { mediaType: 'video/mp2t', fileName: 'a.ts' }),
    ).toBe('text/plain');
    // A label never makes a binary text, nor text a binary type.
    expect(sniffSessionFile(bytes('hello'), { mediaType: 'image/png' })).toBe('text/plain');
    expect(sniffSessionFile(bytes(0x7f, 'ELF', 2, 1, 1), { mediaType: 'text/plain' })).toBeNull();
  });

  it('refuses executables, archives, scripts and markup, however they are labelled or named', () => {
    const hint = { mediaType: 'text/plain', fileName: 'notes.txt' };
    // ELF, Mach-O, PE, zip, gzip: binaries no row names.
    expect(sniffSessionFile(bytes(0x7f, 'ELF', 2, 1, 1, 0), hint)).toBeNull();
    expect(sniffSessionFile(bytes(0xcf, 0xfa, 0xed, 0xfe, 7, 0, 0, 1), hint)).toBeNull();
    expect(sniffSessionFile(bytes('MZ', 0x90, 0, 3, 0), hint)).toBeNull();
    expect(sniffSessionFile(bytes('PK', 3, 4, 20, 0), hint)).toBeNull();
    expect(sniffSessionFile(bytes(0x1f, 0x8b, 8, 0), hint)).toBeNull();
    // Text a program runs: an interpreter line, HTML, SVG, XML — after a BOM
    // or whitespace, in any case.
    expect(sniffSessionFile(bytes('#!/bin/sh\nrm -rf ~\n'), hint)).toBeNull();
    expect(sniffSessionFile(bytes(0xef, 0xbb, 0xbf, '  \n<!DOCTYPE html><p>'), hint)).toBeNull();
    expect(sniffSessionFile(bytes('<HTML><script>'), hint)).toBeNull();
    expect(sniffSessionFile(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'), hint)).toBeNull();
    expect(sniffSessionFile(bytes('<?xml version="1.0"?><svg/>'), hint)).toBeNull();
    // Not UTF-8, or control bytes: not text.
    expect(sniffSessionFile(bytes('caf', 0xe9), hint)).toBeNull();
    expect(sniffSessionFile(bytes(0xc0, 0xaf), hint)).toBeNull();
    expect(sniffSessionFile(bytes(0xed, 0xa0, 0x80), hint)).toBeNull();
    expect(sniffSessionFile(bytes('a', 0, 'b'), hint)).toBeNull();
    expect(sniffSessionFile(bytes('a', 0x1b, '[31m'), hint)).toBeNull();
    // What the image table already refused.
    expect(sniffSessionFile(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
    expect(sniffSessionFile(new Uint8Array())).toBeNull();
  });
});

describe('sessionFileIs', () => {
  it('holds pulled bytes to the type they were parked under', () => {
    expect(sessionFileIs(bytes('%PDF-1.4'), 'application/pdf')).toBe(true);
    expect(sessionFileIs(bytes('plain words'), 'text/markdown')).toBe(true);
    expect(sessionFileIs(bytes('%PDF-1.4'), 'image/png')).toBe(false);
    expect(sessionFileIs(bytes('#!/bin/sh'), 'text/plain')).toBe(false);
    expect(sessionFileIs(bytes('plain words'), 'application/x-sh')).toBe(false);
  });
});

describe('knownCapabilities', () => {
  it('keeps what this side knows and drops what a newer runner added', () => {
    expect(knownCapabilities(['session.files', 'session.teleport', 'session.image'])).toEqual([
      'session.files',
      'session.image',
    ]);
    expect(helloSchema.shape.capabilities.safeParse(['session.teleport']).success).toBe(true);
  });
});

describe('missingFileCapability', () => {
  const image = ['image/png'];
  const pdf = ['image/png', 'application/pdf'];

  it('asks the gesture’s own capability first, then session.files for anything past the images', () => {
    expect(missingFileCapability([], 'paste', image)).toBe('session.image');
    expect(missingFileCapability(['session.files'], 'paste', image)).toBe('session.image');
    expect(missingFileCapability(['session.image'], 'paste', image)).toBeNull();
    expect(missingFileCapability(['session.image'], 'paste', pdf)).toBe('session.files');
    expect(missingFileCapability(['session.image', 'session.files'], 'paste', pdf)).toBeNull();

    expect(missingFileCapability(['session.image'], 'create', image)).toBe('session.create.images');
    expect(missingFileCapability(['session.create.images'], 'create', pdf)).toBe('session.files');
    expect(
      missingFileCapability(['session.create.images', 'session.files'], 'create', pdf),
    ).toBeNull();
  });

  it('asks nothing when no file goes', () => {
    expect(missingFileCapability([], 'create', [])).toBeNull();
  });
});

describe('sessionFileOffered', () => {
  const offered = (type: string, name: string) => sessionFileOffered({ type, name });

  it('offers the table, other text, odd labels for code, and a text ending under any label', () => {
    expect(offered('', 'Screenshot')).toBe(true);
    expect(offered('application/pdf', 'spec.pdf')).toBe(true);
    expect(offered('text/csv; charset=utf-8', 'a.csv')).toBe(true);
    expect(offered('text/x-python', 'a.py')).toBe(true);
    expect(offered('application/ld+json', 'a.jsonld')).toBe(true);
    expect(offered('video/mp2t', 'a.ts')).toBe(true);
    expect(offered('application/x-ruby', 'a.rb')).toBe(true);
    expect(offered('application/octet-stream', 'Cargo.toml')).toBe(true);
  });

  it('refuses markup labels even with a text ending, and binaries the table does not name', () => {
    expect(offered('text/html', 'page.txt')).toBe(false);
    expect(offered('image/svg+xml', 'a.svg')).toBe(false);
    expect(offered('application/zip', 'a.zip')).toBe(false);
    expect(offered('video/mp4', 'a.mp4')).toBe(false);
    expect(offered('application/octet-stream', 'a.exe')).toBe(false);
  });
});

describe('the types an older runner takes', () => {
  it('are the images alone', () => {
    expect(SESSION_IMAGE_MEDIA_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ]);
    expect(isSessionImageType('application/pdf')).toBe(false);
    expect(isSessionImageType('image/webp')).toBe(true);
  });
});

describe('the runner file table', () => {
  it('is the committed generation of this one, so the host cannot disagree about what a file is', async () => {
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const {
      outputPath,
      render,
      vectorsPath,
      renderVectors,
    } = require('../../../scripts/emit-session-file.cjs');
    expect(readFileSync(outputPath, 'utf8')).toBe(render());
    // And the Go test holding the runner's verdict to this one is current.
    expect(readFileSync(vectorsPath, 'utf8')).toBe(renderVectors());
  });
});

describe('pasteSessionImageSchema', () => {
  it('reads the window from a multipart field, and leaves it out when absent', () => {
    expect(pasteSessionImageSchema.parse({ window: '2' })).toEqual({ window: 2 });
    expect(pasteSessionImageSchema.parse({})).toEqual({});
    expect(pasteSessionImageSchema.safeParse({ window: '-1' }).success).toBe(false);
  });
});
