import { betterAuth } from 'better-auth';
import { mobileAppAuth } from '../infrastructure/mobile-app-auth.util';

/**
 * Whether Better Auth trusts the phone app's deep-link scheme. It is opt-in:
 * any Android app can register a custom scheme and be handed the redirect that
 * carries a session, so a deployment that never named one must not trust
 * `oppenheimer://`. The regression is a default scheme coming back.
 *
 * Asked of a real Better Auth instance built from the options, so what is
 * checked is the origin check the sign-in and reset redirects go through.
 */
async function authWith(env: { MOBILE_SCHEME?: string }) {
  const mobile = mobileAppAuth(env);
  const auth = betterAuth({
    baseURL: 'http://localhost:3001',
    secret: 'a-test-secret-that-is-long-enough-0123456789',
    trustedOrigins: ['http://localhost:3000', ...mobile.trustedOrigins],
    plugins: [...mobile.plugins],
    logger: { disabled: true },
  });
  const context = await auth.$context;
  return {
    trusts: (url: string) => context.isTrustedOrigin(url),
    plugins: context.options.plugins?.map((plugin) => plugin.id) ?? [],
  };
}

describe('mobileAppAuth', () => {
  it.each([{}, { MOBILE_SCHEME: '' }, { MOBILE_SCHEME: '  ' }])(
    'with %o trusts no app scheme and loads no Expo plugin',
    async (env) => {
      const auth = await authWith(env);

      expect(auth.trusts('oppenheimer://')).toBe(false);
      expect(auth.trusts('oppenheimer://reset-password')).toBe(false);
      expect(auth.plugins).not.toContain('expo');
      expect(auth.trusts('http://localhost:3000')).toBe(true);
    },
  );

  it('trusts the scheme a deployment names, and only that one', async () => {
    const auth = await authWith({ MOBILE_SCHEME: 'acme' });

    expect(auth.trusts('acme://')).toBe(true);
    expect(auth.plugins).toContain('expo');
    expect(auth.trusts('oppenheimer://')).toBe(false);
  });

  it.each(['https', 'HTTP', 'javascript', 'not a scheme', '1app', 'acme://', ' acme'])(
    'refuses %j at boot rather than trust it',
    (scheme) => {
      expect(() => mobileAppAuth({ MOBILE_SCHEME: scheme })).toThrow(/MOBILE_SCHEME/);
    },
  );
});
