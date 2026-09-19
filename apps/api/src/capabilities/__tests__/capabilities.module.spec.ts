import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '../capabilities.module';

function configWith(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('resolveCapabilities', () => {
  it('reports everything off on a bare install', () => {
    expect(resolveCapabilities(configWith({ 'email.provider': 'console' }))).toEqual({
      google_oauth: false,
      github_oauth: false,
      stripe_billing: false,
      s3_storage: false,
      email_delivery: false,
      hosts: false,
    });
  });

  it('reports hosts from the same predicate the host routes refuse on', () => {
    // Two of the three is not a working pairing flow: without the install URL
    // there is no command to print, and without a usable signing key there is no
    // fingerprint for the runner to pin. The key is validated when the config is
    // parsed, so what is read here is the fingerprint — a capability that said
    // yes while every route answered HOSTS_004 would be the second source of
    // truth the console reads first.
    const partial = configWith({
      'hosts.signingKeyFingerprint': 'f'.repeat(64),
      'hosts.releaseBaseUrl': 'https://releases.example.com',
    });
    expect(resolveCapabilities(partial).hosts).toBe(false);

    const complete = configWith({
      'hosts.signingKeyFingerprint': 'f'.repeat(64),
      'hosts.releaseBaseUrl': 'https://releases.example.com',
      'hosts.installUrl': 'https://releases.example.com/install.sh',
    });
    expect(resolveCapabilities(complete).hosts).toBe(true);
  });

  it('requires both halves of an OAuth credential pair', () => {
    const partial = configWith({ 'oauth.google.clientId': 'id' });
    expect(resolveCapabilities(partial).google_oauth).toBe(false);

    const complete = configWith({
      'oauth.google.clientId': 'id',
      'oauth.google.clientSecret': 'secret',
    });
    expect(resolveCapabilities(complete).google_oauth).toBe(true);
    expect(resolveCapabilities(complete).github_oauth).toBe(false);
  });

  it('enables stripe_billing on the secret key alone', () => {
    expect(resolveCapabilities(configWith({ 'stripe.secretKey': 'sk_test' })).stripe_billing).toBe(
      true,
    );
  });

  it('only counts s3_storage when the provider is s3 AND credentials exist', () => {
    const credsButLocalProvider = configWith({
      'storage.provider': 'local',
      'storage.s3AccessKeyId': 'key',
      'storage.s3SecretAccessKey': 'secret',
    });
    expect(resolveCapabilities(credsButLocalProvider).s3_storage).toBe(false);

    const s3WithoutCreds = configWith({ 'storage.provider': 's3' });
    expect(resolveCapabilities(s3WithoutCreds).s3_storage).toBe(false);

    const s3Configured = configWith({
      'storage.provider': 's3',
      'storage.s3AccessKeyId': 'key',
      'storage.s3SecretAccessKey': 'secret',
    });
    expect(resolveCapabilities(s3Configured).s3_storage).toBe(true);
  });

  it('does not count the console email provider as delivery', () => {
    expect(resolveCapabilities(configWith({ 'email.provider': 'console' })).email_delivery).toBe(
      false,
    );
    expect(resolveCapabilities(configWith({ 'email.provider': 'nodemailer' })).email_delivery).toBe(
      false,
    );
    expect(
      resolveCapabilities(
        configWith({
          'email.provider': 'nodemailer',
          'email.smtpHost': 'smtp.example.com',
        }),
      ).email_delivery,
    ).toBe(true);
    expect(
      resolveCapabilities(
        configWith({
          'email.provider': 'resend',
          'email.resendApiKey': 're_123',
        }),
      ).email_delivery,
    ).toBe(true);
  });
});
