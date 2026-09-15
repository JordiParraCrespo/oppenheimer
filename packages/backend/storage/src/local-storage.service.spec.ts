import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageService } from './local-storage.service';

/**
 * The key a caller supplies reaches `resolve()` directly, so the traversal
 * guard is the only thing between an avatar upload and an arbitrary write
 * outside the upload directory. It is tested against a real temporary
 * directory rather than a mocked `fs`: the guard is about how paths actually
 * resolve, and a mock would happily agree with a wrong answer.
 */

let uploadDir: string;

function storage(publicUrl = 'https://api.example.com') {
  const config = {
    get: (key: string) =>
      key === 'storage.uploadDir' ? uploadDir : key === 'storage.publicUrl' ? publicUrl : undefined,
  } as unknown as ConfigService;
  return new LocalStorageService(config);
}

beforeEach(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), 'oppenheimer-storage-'));
});

afterEach(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});

describe('LocalStorageService', () => {
  describe('upload', () => {
    it('writes the file and returns its public URL', async () => {
      const url = await storage().upload(Buffer.from('hello'), 'avatars/user-1.png', 'image/png');

      expect(url).toBe('https://api.example.com/uploads/avatars/user-1.png');
      await expect(readFile(join(uploadDir, 'avatars/user-1.png'), 'utf8')).resolves.toBe('hello');
    });

    it('creates intermediate directories', async () => {
      await storage().upload(Buffer.from('x'), 'a/b/c/file.txt', 'text/plain');

      await expect(readFile(join(uploadDir, 'a/b/c/file.txt'), 'utf8')).resolves.toBe('x');
    });

    it('overwrites an existing key', async () => {
      const subject = storage();
      await subject.upload(Buffer.from('first'), 'k.txt', 'text/plain');
      await subject.upload(Buffer.from('second'), 'k.txt', 'text/plain');

      await expect(readFile(join(uploadDir, 'k.txt'), 'utf8')).resolves.toBe('second');
    });
  });

  describe('the traversal guard', () => {
    it.each([
      '../escaped.txt',
      '../../etc/passwd',
      'avatars/../../escaped.txt',
      'a/b/../../../escaped.txt',
    ])('rejects the relative escape %s', async (key) => {
      await expect(storage().upload(Buffer.from('x'), key, 'text/plain')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an absolute path', async () => {
      // `resolve(uploadDir, '/etc/passwd')` is `/etc/passwd` — the upload
      // directory is discarded entirely, which is the quietest form of this bug.
      await expect(
        storage().upload(Buffer.from('x'), `${sep}etc${sep}passwd`, 'text/plain'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a sibling directory that shares the upload directory’s prefix', async () => {
      // The guard compares against `uploadDir + sep`, not the bare string. With
      // a plain `startsWith(uploadDir)`, a key resolving to `<uploadDir>-evil/x`
      // would pass — the classic off-by-one in this check.
      const key = `..${sep}${uploadDir.split(sep).pop()}-evil${sep}x.txt`;

      await expect(storage().upload(Buffer.from('x'), key, 'text/plain')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('allows a traversal that stays inside the directory', async () => {
      // The rule is where the path lands, not whether it contains `..`.
      await expect(
        storage().upload(Buffer.from('x'), 'a/../b.txt', 'text/plain'),
      ).resolves.toContain('/uploads/a/../b.txt');
      await expect(readFile(join(uploadDir, 'b.txt'), 'utf8')).resolves.toBe('x');
    });

    it('guards delete as well as upload', async () => {
      // A delete that escapes is a remote file removal, which is worse than the
      // write it mirrors.
      await expect(storage().delete('../../escaped.txt')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('does not guard getSignedUrl, which only builds a string', async () => {
      // Deliberately different from upload/delete: `getSignedUrl` touches no
      // filesystem, so there is no path to escape. It interpolates the key into
      // a URL, and the traversal is resolved by whatever serves `/uploads` —
      // `main.ts` mounts a static handler, which normalises the request path
      // itself. Pinned here so the asymmetry reads as deliberate rather than an
      // oversight someone "fixes" with a guard that would reject valid keys.
      await expect(storage().getSignedUrl('../../secret')).resolves.toBe(
        'https://api.example.com/uploads/../../secret',
      );
    });
  });

  describe('delete', () => {
    it('removes a stored file', async () => {
      const subject = storage();
      await subject.upload(Buffer.from('x'), 'k.txt', 'text/plain');

      await subject.delete('k.txt');

      await expect(readFile(join(uploadDir, 'k.txt'), 'utf8')).rejects.toThrow();
    });

    it('surfaces a missing file rather than swallowing it', async () => {
      // The caller decides whether a missing file is fine. Silently succeeding
      // would hide a key mismatch between the database and the disk.
      await expect(storage().delete('never-existed.txt')).rejects.toThrow();
    });
  });

  describe('public URLs', () => {
    it('trims trailing slashes off the configured base', async () => {
      // Otherwise keys join as `https://api.example.com//uploads/…`, which some
      // proxies normalise and some serve as a different path.
      await expect(storage('https://api.example.com///').getSignedUrl('k.png')).resolves.toBe(
        'https://api.example.com/uploads/k.png',
      );
    });

    it('falls back to a root-relative URL when no base is configured', async () => {
      await expect(storage('').getSignedUrl('k.png')).resolves.toBe('/uploads/k.png');
    });

    it('ignores the expiry argument — a local file has no signature to expire', async () => {
      const subject = storage();

      await expect(subject.getSignedUrl('k.png', 60)).resolves.toBe(
        await subject.getSignedUrl('k.png'),
      );
    });
  });
});
