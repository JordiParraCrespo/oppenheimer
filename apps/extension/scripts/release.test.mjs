import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { zip } from './package.mjs';
import { publishOutcome, readConfig, uploadOutcome } from './publish.mjs';

/** Every file in a zip, read back through its central directory. */
function unzip(archive) {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.toString('utf8', at + 46, at + 46 + nameLength);
    const start = local + 30 + archive.readUInt16LE(local + 26);
    files[name] = inflateRawSync(archive.subarray(start, start + size)).toString('utf8');
    at += 46 + nameLength;
  }
  return files;
}

describe('the store package', () => {
  // The Web Store refuses a package it cannot open or whose manifest is not at the root.
  it('holds every file, at its path, with its contents', () => {
    const archive = zip([
      { name: 'manifest.json', data: Buffer.from('{"version":"0.2.0"}') },
      { name: 'icons/icon-16.png', data: Buffer.from('png bytes') },
      { name: '_locales/es/messages.json', data: Buffer.from('{"extName":"Oppenheimer"}') },
    ]);

    expect(unzip(archive)).toEqual({
      'manifest.json': '{"version":"0.2.0"}',
      'icons/icon-16.png': 'png bytes',
      '_locales/es/messages.json': '{"extName":"Oppenheimer"}',
    });
  });

  it('is the same bytes for the same files, so a rebuild is not a new version', () => {
    const files = [{ name: 'a.js', data: Buffer.from('x') }];
    expect(zip(files).equals(zip(files))).toBe(true);
  });
});

describe('publishing', () => {
  it('names every missing setting at once, before calling Google', () => {
    expect(() => readConfig({ CWS_PUBLISHER_ID: 'p', CWS_EXTENSION_ID: 'e' })).toThrow(
      'missing CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN',
    );
  });

  it('waits on an upload still processing and fails on a refused one', () => {
    expect(uploadOutcome({ uploadState: 'SUCCEEDED', crxVersion: '0.2.0' })).toEqual({
      done: true,
      version: '0.2.0',
    });
    expect(uploadOutcome({ uploadState: 'IN_PROGRESS' })).toEqual({ done: false });
    expect(() => uploadOutcome({ uploadState: 'FAILED' })).toThrow('upload FAILED');
  });

  // A release that Google refused must fail the workflow, not tag a version nobody gets.
  it('fails on a submission the store did not take', () => {
    expect(publishOutcome({ state: 'PENDING_REVIEW' })).toBe('state PENDING_REVIEW');
    expect(() => publishOutcome({ state: 'REJECTED' })).toThrow('publish REJECTED');
  });
});
