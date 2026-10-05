/**
 * Bytes both sides must judge alike: the runner's `FileIs` is held to
 * `sessionFileIs` on each of these. `scripts/emit-session-file.cjs` computes
 * the verdicts here and writes them into a Go test, so the text rule has one
 * owner and the runner's reading of it is checked, not trusted.
 *
 * Build-only, like `samples.ts`: not exported from the protocol barrel. A
 * case worth adding is any byte sequence where the two languages could read
 * differently — a control byte, a BOM, whitespace before an opening, a
 * multibyte character on the opening's cut, a malformed UTF-8 form.
 */
type Part = number | string;

export interface SessionFileVector {
  name: string;
  /** Strings are ASCII, written as their bytes; numbers are single bytes. */
  bytes: readonly Part[];
  mediaType: string;
}

const v = (name: string, mediaType: string, ...bytes: Part[]): SessionFileVector => ({
  name,
  bytes,
  mediaType,
});

export const SESSION_FILE_VECTORS: readonly SessionFileVector[] = [
  v('png', 'image/png', 0x89, 'PNG\r\n', 0x1a, '\n', 0),
  v('jpeg', 'image/jpeg', 0xff, 0xd8, 0xff, 0xe0),
  v('gif87', 'image/gif', 'GIF87a'),
  v('gif89', 'image/gif', 'GIF89a'),
  v('webp', 'image/webp', 'RIFF', 0, 0, 0, 0, 'WEBPVP8 '),
  v('wave is not webp', 'image/webp', 'RIFF', 0, 0, 0, 0, 'WAVE'),
  v('pdf', 'application/pdf', '%PDF-1.7\n', 0xe2, 0xe3, 0xcf, 0xd3),
  v('pdf is not png', 'image/png', '%PDF-1.4'),
  v('png is not text', 'text/plain', 0x89, 'PNG\r\n', 0x1a, '\n'),
  v('empty text', 'text/plain'),
  v(
    'markdown with UTF-8',
    'text/markdown',
    '# Notes\n\nCaf',
    0xc3,
    0xa9,
    ' ',
    0xe2,
    0x9c,
    0x93,
    '\r\n\tx\f',
  ),
  v('csv', 'text/csv', 'a,b\n1,2'),
  v('json', 'application/json', '{"a":1}'),
  v('BOM then text', 'text/plain', 0xef, 0xbb, 0xbf, 'plain'),
  v('ELF', 'text/plain', 0x7f, 'ELF', 2, 1, 1, 0),
  v('Mach-O', 'text/plain', 0xcf, 0xfa, 0xed, 0xfe, 7, 0, 0, 1),
  v('PE', 'text/plain', 'MZ', 0x90, 0, 3, 0),
  v('zip', 'text/plain', 'PK', 3, 4, 20, 0),
  v('gzip', 'text/plain', 0x1f, 0x8b, 8, 0),
  v('shebang', 'text/plain', '#!/bin/sh\nrm -rf ~\n'),
  v('BOM, whitespace, doctype', 'text/plain', 0xef, 0xbb, 0xbf, '  \n<!DOCTYPE html><p>'),
  v('upper-case html', 'text/plain', '<HTML><script>'),
  v('svg', 'text/plain', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
  v('xml', 'text/plain', '<?xml version="1.0"?><svg/>'),
  v('whitespace other than ASCII is not trimmed', 'text/plain', 0xc2, 0xa0, '<html>'),
  v('multibyte on the opening cut', 'text/plain', '<scrip', 0xc3, 0xa9, 'abcdefghijk'),
  v('multibyte straddling byte 16', 'text/plain', 'abcdefghijklmno', 0xe2, 0x9c, 0x93),
  v('latin-1 is not UTF-8', 'text/plain', 'caf', 0xe9),
  v('overlong slash', 'text/plain', 0xc0, 0xaf),
  v('surrogate', 'text/plain', 0xed, 0xa0, 0x80),
  v('past U+10FFFF', 'text/plain', 0xf4, 0x90, 0x80, 0x80),
  v('truncated sequence', 'text/plain', 'ok', 0xe2, 0x9c),
  v('NUL', 'text/plain', 'a', 0, 'b'),
  v('escape', 'text/plain', 'a', 0x1b, '[31m'),
  v('DEL', 'text/plain', 'a', 0x7f),
  v('unknown type', 'application/x-sh', 'plain words'),
];

/** A vector's bytes. */
export function vectorBytes(vector: SessionFileVector): Uint8Array {
  return new Uint8Array(
    vector.bytes.flatMap((part) =>
      typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : [part],
    ),
  );
}
