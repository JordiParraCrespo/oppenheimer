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
      s3_storage: false,
      email_delivery: false,
      github_app: false,
      hosts: false,
      session_namer: false,
    });
  });

  it('only reports a session namer once a model can actually be called', () => {
    // A provider switched on without its key is not configured: sessions are
    // then named from their prompt's words, which is a supported outcome. The
    // capability is how that shows up in the startup log.
    const noKey = configWith({ 'llm.provider': 'openrouter', 'llm.model': 'a-model-id' });
    expect(resolveCapabilities(noKey).session_namer).toBe(false);

    const noModel = configWith({ 'llm.provider': 'openrouter', 'llm.apiKey': 'sk-or-test' });
    expect(resolveCapabilities(noModel).session_namer).toBe(false);

    const configured = configWith({
      'llm.provider': 'openrouter',
      'llm.apiKey': 'sk-or-test',
      'llm.model': 'a-model-id',
    });
    expect(resolveCapabilities(configured).session_namer).toBe(true);

    // The naming job may name its own model over the provider's default.
    const namerModel = configWith({
      'llm.provider': 'anthropic',
      'llm.apiKey': 'sk-ant-test',
      'sessions.namerModel': 'a-small-model',
    });
    expect(resolveCapabilities(namerModel).session_namer).toBe(true);
  });

  it('reports a namer for an OpenAI-compatible server, key or no key', () => {
    // A model on your own machine wants no key, and demanding one would report
    // "no namer" for exactly the deployment where the prompt never leaves the
    // building.
    const local = configWith({
      'llm.provider': 'openai-compatible',
      'llm.baseUrl': 'http://localhost:11434/v1',
      'llm.model': 'a-model-id',
    });
    expect(resolveCapabilities(local).session_namer).toBe(true);

    // Without somewhere to send the prompt it is still not configured.
    const noBaseUrl = configWith({
      'llm.provider': 'openai-compatible',
      'llm.model': 'a-model-id',
    });
    expect(resolveCapabilities(noBaseUrl).session_namer).toBe(false);
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

  it('needs the whole GitHub App credential set, not part of it', () => {
    const configured = {
      'githubApp.appId': '1234567',
      'githubApp.privateKey': '-----BEGIN RSA PRIVATE KEY-----',
      'githubApp.webhookSecret': 'whsec',
      'githubApp.clientId': 'Iv1.abc',
      'githubApp.clientSecret': 'shhh',
      'githubApp.slug': 'oppenheimer-sessions',
    };
    expect(resolveCapabilities(configWith(configured)).github_app).toBe(true);

    // A partial set is off rather than half-on: the token mint needs the key,
    // the claim proof needs the OAuth pair, and a suspension is only trustworthy
    // with the webhook secret. Any one missing removes the whole feature.
    for (const key of Object.keys(configured)) {
      const partial = { ...configured, [key]: undefined };
      expect(resolveCapabilities(configWith(partial)).github_app).toBe(false);
    }
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
