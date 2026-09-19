import { generateKeyPairSync } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { hostsAreConfigured, hostsConfig } from '../hosts.config';

/**
 * The `hosts` section, and the one predicate the host routes and the `hosts`
 * capability both answer from.
 */

function withEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return hostsConfig();
}

function config(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const ED25519_KEY = generateKeyPairSync('ed25519')
  .privateKey.export({ format: 'der', type: 'pkcs8' })
  .toString('base64');

describe('hostsConfig', () => {
  beforeEach(() => {
    for (const key of [
      'CONTROL_PLANE_URL',
      'CONTROL_PLANE_SIGNING_KEY',
      'RUNNER_RELEASE_BASE_URL',
      'RUNNER_RELEASE_CHANNEL',
      'RUNNER_INSTALL_URL',
    ]) {
      delete process.env[key];
    }
    process.env.BETTER_AUTH_URL = 'https://api.example.com';
  });

  it('falls back to the API’s own public URL for the audience runners sign for', () => {
    expect(withEnv({}).controlPlaneUrl).toBe('https://api.example.com');
  });

  it('lets a deployment override it, and ignores a trailing slash either way', () => {
    // The runner stores whatever URL it registered with, and the two spellings
    // are the same control plane.
    expect(withEnv({ CONTROL_PLANE_URL: 'https://runners.example.com/' }).controlPlaneUrl).toBe(
      'https://runners.example.com',
    );
  });

  it('exposes only the fingerprint of the signing key, never the key', () => {
    const parsed = withEnv({ CONTROL_PLANE_SIGNING_KEY: ED25519_KEY });

    expect(parsed.signingKeyFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(parsed)).not.toContain(ED25519_KEY);
  });

  it('treats a malformed or wrong-kind key as no key at all', () => {
    // Not a sentinel and not a throw: absence is what "hosts are not configured"
    // is built from, and a fingerprint of the wrong thing is a pin no runner can
    // ever make.
    expect(
      withEnv({ CONTROL_PLANE_SIGNING_KEY: 'not a key' }).signingKeyFingerprint,
    ).toBeUndefined();

    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ format: 'der', type: 'pkcs8' })
      .toString('base64');
    expect(withEnv({ CONTROL_PLANE_SIGNING_KEY: rsa }).signingKeyFingerprint).toBeUndefined();
  });

  it('defaults the release channel to stable', () => {
    expect(withEnv({}).releaseChannel).toBe('stable');
  });
});

describe('hostsAreConfigured', () => {
  const complete = {
    'hosts.installUrl': 'https://releases.example.com/install.sh',
    'hosts.releaseBaseUrl': 'https://releases.example.com',
    'hosts.signingKeyFingerprint': 'f'.repeat(64),
  };

  it('is true only when a machine could actually pair', () => {
    expect(hostsAreConfigured(config(complete))).toBe(true);
  });

  it('is false when any of the three is missing', () => {
    for (const key of Object.keys(complete)) {
      const partial = { ...complete, [key]: undefined };
      expect(hostsAreConfigured(config(partial)), `without ${key}`).toBe(false);
    }
  });
});
