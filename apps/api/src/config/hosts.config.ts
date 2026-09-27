import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/** DER prefix of an Ed25519 SubjectPublicKeyInfo, which wraps the raw 32 bytes. */
const SPKI_PREFIX_BYTES = 12;

/**
 * The public fingerprint of the control plane's Ed25519 signing key: SHA-256 of
 * the raw public key, hex — the value a runner pins at registration (F6).
 *
 * Derived here, at parse time, so the **private** key never leaves this factory:
 * what the rest of the process can read is the fingerprint. An unparsable or
 * non-Ed25519 value yields `undefined`, which is how a malformed key reports as
 * "not configured" rather than as a fingerprint of the wrong thing — a sentinel
 * would be a string pretending to be an absence
 * (`.agents/rules/api-config.md`).
 */
function fingerprintOf(base64PrivateKey: string | undefined): string | undefined {
  if (!base64PrivateKey) return undefined;
  try {
    const der = Buffer.from(base64PrivateKey.replace(/\s+/g, ''), 'base64');
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    if (privateKey.asymmetricKeyType !== 'ed25519') return undefined;
    const raw = createPublicKey(privateKey)
      .export({ format: 'der', type: 'spki' })
      .subarray(SPKI_PREFIX_BYTES);
    return createHash('sha256').update(raw).digest('hex');
  } catch {
    return undefined;
  }
}

/**
 * What this deployment needs in order to pair a machine with it.
 *
 * **Optional capability**, all of it: a deployment with no runner release to
 * point at cannot hand a machine an install command, so the host routes answer
 * a "not configured" problem and nothing else changes (`hosts` in
 * `capabilities.module.ts`). Required settings fail boot instead — see
 * `.agents/rules/api-config.md` for which is which.
 *
 * `controlPlaneUrl` is the exception: it always has a value, because the runner
 * signs its boot assertion with this origin as the JWT audience
 * (`product/versions/mvp/01-protocol.md`) and a verifier with nothing to
 * compare against would accept a token minted for someone else. It defaults to
 * the API's own public URL, which is what a runner dials, and
 * `CONTROL_PLANE_URL` overrides it for a deployment whose runners reach the API
 * on a different name than its browsers do.
 */
const schema = z
  .object({
    controlPlaneUrl: z.string().url().optional(),
    apiPublicUrl: z.string().url().default('http://localhost:3001'),
    /**
     * The control plane's own Ed25519 private key, as the base64 of its PKCS#8
     * DER — one line, no PEM header:
     * `openssl genpkey -algorithm ed25519 -outform DER | base64 -w0`.
     * Only its public fingerprint leaves the process: a runner pins it at
     * registration (F6) and refuses to speak to anything else afterwards.
     */
    signingKey: z.string().optional(),
    releaseBaseUrl: z.string().url().optional(),
    releaseChannel: z.enum(['stable', 'beta']).default('stable'),
    installUrl: z.string().url().optional(),
    /**
     * SHA-256 of the installer at `installUrl`, hex, as `scripts/runner/release.sh`
     * prints it. Shown beside the install command so the careful path —
     * download, read, check, run — needs no second source of truth (09 §1).
     * Anything that is not a 64-character hex digest counts as unset.
     */
    installSha256: z
      .string()
      .optional()
      .transform((value) => {
        const digest = value?.trim().toLowerCase();
        return digest && /^[0-9a-f]{64}$/.test(digest) ? digest : undefined;
      }),
    /**
     * The IP databases a connecting host's address is placed with: DB-IP Lite
     * City and ASN, `.mmdb` files on disk (`scripts/geoip/fetch-dbip.mjs`).
     * Optional capability (`ip_geolocation`); either file alone is used for
     * what it answers.
     */
    geoipCityDb: z.string().min(1).optional(),
    geoipAsnDb: z.string().min(1).optional(),
  })
  .transform(({ apiPublicUrl, controlPlaneUrl, signingKey, ...rest }) => ({
    // Trailing slashes are stripped on both sides of the audience comparison,
    // so `https://api.example.com/` and `https://api.example.com` are the same
    // control plane rather than two.
    controlPlaneUrl: (controlPlaneUrl ?? apiPublicUrl).replace(/\/+$/, ''),
    signingKeyFingerprint: fingerprintOf(signingKey),
    ...rest,
  }));

export const hostsConfig = registerAs('hosts', () =>
  parseEnv('hosts', schema, {
    controlPlaneUrl: 'CONTROL_PLANE_URL',
    apiPublicUrl: 'BETTER_AUTH_URL',
    signingKey: 'CONTROL_PLANE_SIGNING_KEY',
    releaseBaseUrl: 'RUNNER_RELEASE_BASE_URL',
    releaseChannel: 'RUNNER_RELEASE_CHANNEL',
    installUrl: 'RUNNER_INSTALL_URL',
    installSha256: 'RUNNER_INSTALL_SHA256',
    geoipCityDb: 'HOSTS_GEOIP_CITY_DB',
    geoipAsnDb: 'HOSTS_GEOIP_ASN_DB',
  }),
);

/**
 * Whether a connecting host's network can be placed: at least one IP database
 * is named. One function for the capability and the adapter, as for `hosts`.
 */
export function ipGeolocationIsConfigured(configService: ConfigService): boolean {
  return Boolean(
    configService.get<string>('hosts.geoipCityDb') || configService.get<string>('hosts.geoipAsnDb'),
  );
}

/**
 * Whether this deployment can pair a machine at all: somewhere to download the
 * runner from, somewhere to fetch signed releases from, and a usable key of its
 * own for the runner to pin.
 *
 * One function with two callers, and that is the point: `RunnerReleaseConfig`
 * refuses every host route on it, and `resolveCapabilities` reports the `hosts`
 * capability from it. A capability that said yes while every route answered
 * `HOSTS_004` would be a second source of truth, and the console reads the
 * capability first.
 */
export function hostsAreConfigured(configService: ConfigService): boolean {
  return Boolean(
    configService.get<string>('hosts.installUrl') &&
      configService.get<string>('hosts.releaseBaseUrl') &&
      configService.get<string>('hosts.signingKeyFingerprint'),
  );
}
