import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageService } from './storage';

/**
 * The browser half of `IStorageService`, injected into `@oppenheimer/frontend`'s
 * container. Thin, but it is the seam the shared auth and settings code writes
 * through, and `localStorage.getItem` returning `null` for a missing key is a
 * contract the interface promises rather than an accident of the DOM API.
 */

describe('LocalStorageService', () => {
  let storage: LocalStorageService;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorageService();
  });

  it('round-trips a value', async () => {
    await storage.set('token', 'abc');

    await expect(storage.get('token')).resolves.toBe('abc');
  });

  it('resolves null for a key that was never set', async () => {
    // The port's contract. A caller distinguishing "absent" from "empty" needs
    // this to be null rather than undefined or an empty string.
    await expect(storage.get('missing')).resolves.toBeNull();
  });

  it('overwrites an existing key', async () => {
    await storage.set('k', 'first');
    await storage.set('k', 'second');

    await expect(storage.get('k')).resolves.toBe('second');
  });

  it('preserves an empty string rather than reporting it as absent', async () => {
    await storage.set('k', '');

    await expect(storage.get('k')).resolves.toBe('');
  });

  it('removes one key without touching the others', async () => {
    await storage.set('a', '1');
    await storage.set('b', '2');

    await storage.remove('a');

    await expect(storage.get('a')).resolves.toBeNull();
    await expect(storage.get('b')).resolves.toBe('2');
  });

  it('removing a missing key is a no-op, not a failure', async () => {
    await expect(storage.remove('missing')).resolves.toBeUndefined();
  });

  it('clears everything', async () => {
    await storage.set('a', '1');
    await storage.set('b', '2');

    await storage.clear();

    await expect(storage.get('a')).resolves.toBeNull();
    await expect(storage.get('b')).resolves.toBeNull();
  });
});
