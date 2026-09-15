import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeSessionPreload } from './session-preload';

const user = {
  id: 'user-1',
  email: 'reader@example.com',
  emailVerified: true,
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'admin',
};

/**
 * The preload is a browser-only handshake, and this package's tests run in
 * Node, so the one global it reads is stubbed here rather than pulling in a DOM.
 */
function plant(value: Promise<unknown> | undefined): void {
  vi.stubGlobal('window', { __OPPENHEIMER_SESSION_PRELOAD__: value });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('consumeSessionPreload', () => {
  it('maps a preloaded body to a session', async () => {
    plant(Promise.resolve({ user }));

    await expect(consumeSessionPreload()).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'reader@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'admin',
        emailVerified: true,
      },
    });
  });

  it('reports a confirmed anonymous visitor as null', async () => {
    plant(Promise.resolve(null));

    await expect(consumeSessionPreload()).resolves.toBeNull();
  });

  it('is one-shot, so the auth client owns every later lookup', async () => {
    plant(Promise.resolve({ user }));

    await consumeSessionPreload();

    await expect(consumeSessionPreload()).resolves.toBeUndefined();
  });

  it('falls back when nothing was planted', async () => {
    plant(undefined);

    await expect(consumeSessionPreload()).resolves.toBeUndefined();
  });

  // The distinction that matters: a failed request must not read as "signed
  // out", which would bounce a signed-in reader to /login on a network blip.
  it('falls back when the request failed', async () => {
    plant(Promise.reject(new Error('offline')));

    await expect(consumeSessionPreload()).resolves.toBeUndefined();
  });

  it.each([
    ['an HTML error page', '<!doctype html>'],
    ['a body with no user', { session: { id: 's-1' } }],
    ['a user with no id', { user: { email: 'reader@example.com' } }],
  ])('falls back on %s', async (_label, body) => {
    plant(Promise.resolve(body));

    await expect(consumeSessionPreload()).resolves.toBeUndefined();
  });
});
